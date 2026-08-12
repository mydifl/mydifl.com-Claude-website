# DIFL Certificate Registry — production setup

The application code is secure-by-default, but it must be connected to managed services and hardened at the account/hosting level before real student data is imported.

## 1. Create the protected Supabase project

1. Create a dedicated production project in the India/Singapore region that best matches DIFL's data-location needs.
2. Run `supabase/migrations/202608120001_certificate_registry.sql` in the SQL editor.
3. Create the first owner in Authentication, then run the owner bootstrap statement at the bottom of the migration with the correct email.
4. Disable public user registration. Staff accounts must be invitation-only.
5. Set short access-token lifetime (recommended: 15 minutes), enable leaked-password protection, and require strong passwords.
6. Keep PITR/database backups enabled according to the chosen plan.
7. In Storage, confirm `certificate-files` is private. It must never be changed to a public bucket.

## 2. Configure hosting secrets

Add these values to Vercel Production, Preview, and Development environments as appropriate:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY` (publishable by design; RLS remains the security boundary)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never prefix with `PUBLIC_`)
- `PUBLIC_SITE_URL=https://mydifl.com`

Rotate the service-role key immediately if it is ever pasted into a public location, committed, or exposed in browser output.

## 3. Configure security controls outside the code

1. In Vercel Firewall, rate-limit `POST /api/verify` by IP (start with 20 requests/minute and return 429) and challenge repeated offenders. Log the rule first, verify normal traffic, then enforce it.
2. Rate-limit and challenge requests to `/admin/*` and `/api/admin/*` more strictly.
3. Enable Vercel's managed DDoS/WAF protections and deployment protection for previews.
4. Protect Vercel and Supabase owner accounts with phishing-resistant MFA/security keys. Do not share owner logins.
5. Restrict project membership to the minimum number of trusted owners.
6. Set Supabase Auth redirect allow-list to `https://mydifl.com/admin/` and required preview URLs only.

## 4. Staff operating rules

- Every user must enrol TOTP on first sign-in. Database policies reject certificate writes unless the session is at MFA level AAL2.
- Create a separate account for each staff member. Never use a shared password.
- Use `viewer` for read-only access, `staff` for certificate entry, `admin` for invitations/team administration, and keep `owner` limited to the institute owner.
- Deactivate profiles promptly when staff leave. Keep their audit history.
- Never send verification CSVs through public groups. Share a single certificate link only with the student or intended verifier.
- Do not upload Aadhaar, passports, payment records, or unrelated identity documents.
- Before importing legacy records, clean the spreadsheet and keep only data necessary for certificate administration.

## 5. File and recovery controls

- The UI accepts only PDF, JPG, and PNG up to 10 MB and checks file signatures. For high-assurance operations, add malware scanning in a quarantine workflow before making new uploads available to staff.
- Maintain an encrypted offline export of certificate metadata and an inventory of object-storage files. Test recovery at least twice per year.
- Review audit logs monthly for unexpected edits, status changes, access from unusual locations, and invitation activity.

## 6. Go-live checks

- Confirm an anonymous user cannot read `certificates`, `staff_profiles`, `certificate_audit_log`, or storage objects.
- Confirm a logged-in AAL1 user cannot insert or update records.
- Confirm a viewer cannot modify records.
- Confirm verification returns only masked name, certificate number, course/language/level, issue date, and status.
- Confirm phone, email, address, scan path, notes, and token hash never appear in public responses.
- Confirm a revoked certificate is clearly shown as not valid.
- Test invite, MFA enrolment, CSV import, private scan viewing, and audit records with non-production sample data.
