-- Minimum PostgreSQL privileges for authenticated DIFL staff.
-- Row-level policies remain the authority for which records each user may access.
grant usage on type public.staff_role to authenticated;
grant usage on type public.certificate_status to authenticated;

grant select, insert, update on table public.staff_profiles to authenticated;
grant select, insert, update on table public.certificates to authenticated;
grant select on table public.certificate_audit_log to authenticated;

-- Certificate and staff records are deliberately not deletable by application users.
revoke delete on table public.staff_profiles from authenticated;
revoke delete on table public.certificates from authenticated;
revoke insert, update, delete on table public.certificate_audit_log from authenticated;
