-- Multiple private files per certificate, including certificate scans and photographs.
create type public.certificate_attachment_kind as enum ('certificate', 'photo', 'other');

create table public.certificate_attachments (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  kind public.certificate_attachment_kind not null,
  file_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  file_sha256 text not null check (length(file_sha256) = 64),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

create index certificate_attachments_certificate_idx on public.certificate_attachments(certificate_id, kind);
alter table public.certificate_attachments enable row level security;

create policy "Staff can view private certificate attachments"
on public.certificate_attachments for select to authenticated
using (public.is_active_staff());

create policy "Staff can add private certificate attachments with MFA"
on public.certificate_attachments for insert to authenticated
with check (
  public.is_active_staff(array['owner','admin','staff']::public.staff_role[])
  and (select auth.jwt()->>'aal') = 'aal2'
  and created_by = auth.uid()
);

grant usage on type public.certificate_attachment_kind to authenticated, service_role;
grant select, insert on table public.certificate_attachments to authenticated;
grant select, insert on table public.certificate_attachments to service_role;
revoke update, delete on table public.certificate_attachments from authenticated, service_role;
