-- Minimum privileges for trusted server-side registry operations.
-- The service role bypasses RLS but still requires PostgreSQL table privileges.
grant usage on type public.staff_role to service_role;
grant usage on type public.certificate_status to service_role;

grant select, insert, update on table public.staff_profiles to service_role;
grant select, insert, update on table public.certificates to service_role;
grant select on table public.certificate_audit_log to service_role;

revoke delete on table public.staff_profiles from service_role;
revoke delete on table public.certificates from service_role;
revoke insert, update, delete on table public.certificate_audit_log from service_role;
