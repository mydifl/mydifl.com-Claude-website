-- DIFL certificate registry: private-by-default schema, staff authorization,
-- MFA enforcement for writes, immutable audit trail, and token-based verification.
create extension if not exists pgcrypto with schema extensions;

create type public.staff_role as enum ('owner', 'admin', 'staff', 'viewer');
create type public.certificate_status as enum ('valid', 'revoked', 'replaced');

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.staff_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  last_seen_at timestamptz
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  verification_token_hash text not null unique check (length(verification_token_hash) = 64),
  student_name text not null,
  mobile text,
  email text,
  contact_address text,
  course_name text not null,
  language text not null,
  level text,
  issue_date date not null,
  status public.certificate_status not null default 'valid',
  status_note text,
  file_path text,
  file_name text,
  file_sha256 text,
  source text not null default 'manual' check (source in ('manual', 'csv_import', 'archive_digitisation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id)
);

create index certificates_number_idx on public.certificates (certificate_number);
create index certificates_name_idx on public.certificates (lower(student_name));
create index certificates_issue_date_idx on public.certificates (issue_date desc);
create index certificates_status_idx on public.certificates (status);

create table public.certificate_audit_log (
  id bigint generated always as identity primary key,
  certificate_id uuid references public.certificates(id) on delete set null,
  actor_id uuid references auth.users(id),
  action text not null,
  old_record jsonb,
  new_record jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.staff_profiles enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_audit_log enable row level security;

create or replace function public.is_active_staff(allowed_roles public.staff_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and (allowed_roles is null or p.role = any(allowed_roles))
  );
$$;

revoke all on function public.is_active_staff(public.staff_role[]) from public;
grant execute on function public.is_active_staff(public.staff_role[]) to authenticated;

create policy "Staff can read their directory"
on public.staff_profiles for select to authenticated
using (public.is_active_staff());

create policy "Admins manage staff profiles with MFA"
on public.staff_profiles for all to authenticated
using (
  public.is_active_staff(array['owner','admin']::public.staff_role[])
  and (select auth.jwt()->>'aal') = 'aal2'
)
with check (
  public.is_active_staff(array['owner','admin']::public.staff_role[])
  and (select auth.jwt()->>'aal') = 'aal2'
);

create policy "Active staff can read certificates"
on public.certificates for select to authenticated
using (public.is_active_staff());

create policy "Staff can create certificates with MFA"
on public.certificates for insert to authenticated
with check (
  public.is_active_staff(array['owner','admin','staff']::public.staff_role[])
  and (select auth.jwt()->>'aal') = 'aal2'
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "Staff can update certificates with MFA"
on public.certificates for update to authenticated
using (
  public.is_active_staff(array['owner','admin','staff']::public.staff_role[])
  and (select auth.jwt()->>'aal') = 'aal2'
)
with check (
  public.is_active_staff(array['owner','admin','staff']::public.staff_role[])
  and (select auth.jwt()->>'aal') = 'aal2'
  and updated_by = auth.uid()
);

-- Records are deliberately never deleted from the application. Revoke them instead.
create policy "Staff can read audit history"
on public.certificate_audit_log for select to authenticated
using (public.is_active_staff(array['owner','admin']::public.staff_role[]));

create or replace function public.set_certificate_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_certificate_updated_at
before update on public.certificates
for each row execute function public.set_certificate_updated_at();

create or replace function public.audit_certificate_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.certificate_audit_log(certificate_id, actor_id, action, new_record)
    values (new.id, auth.uid(), 'created', to_jsonb(new) - 'verification_token_hash');
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.certificate_audit_log(certificate_id, actor_id, action, old_record, new_record)
    values (new.id, auth.uid(), case when old.status is distinct from new.status then 'status_changed' else 'updated' end,
      to_jsonb(old) - 'verification_token_hash', to_jsonb(new) - 'verification_token_hash');
    return new;
  end if;
  return null;
end;
$$;

create trigger audit_certificate_change
after insert or update on public.certificates
for each row execute function public.audit_certificate_change();

create or replace function public.mask_name_twenty_percent(full_name text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  total_letters integer := length(regexp_replace(coalesce(full_name, ''), '[^[:alpha:]]', '', 'g'));
  target integer;
  letter_no integer := 0;
  masked_no integer := 0;
  current_char text;
  output text := '';
  i integer;
begin
  if total_letters = 0 then return ''; end if;
  target := greatest(1, ceil(total_letters * 0.20)::integer);
  for i in 1..char_length(coalesce(full_name, '')) loop
    current_char := substr(full_name, i, 1);
    if current_char ~ '[[:alpha:]]' then
      letter_no := letter_no + 1;
      if masked_no < target and letter_no >= ceil(((masked_no + 1.0) * total_letters) / target)::integer then
        output := output || '*';
        masked_no := masked_no + 1;
      else
        output := output || current_char;
      end if;
    else
      output := output || current_char;
    end if;
  end loop;
  return output;
end;
$$;

-- Only this narrow, non-PII result is callable by the public verification API.
create or replace function public.verify_certificate(p_token_hash text)
returns table (
  certificate_number text,
  student_name_masked text,
  course_name text,
  language text,
  level text,
  issue_date date,
  status public.certificate_status,
  verified_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select c.certificate_number, public.mask_name_twenty_percent(c.student_name),
    c.course_name, c.language, c.level, c.issue_date, c.status, now()
  from public.certificates c
  where c.verification_token_hash = lower(p_token_hash)
  limit 1;
$$;

revoke all on function public.verify_certificate(text) from public, anon, authenticated;
grant execute on function public.verify_certificate(text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-files', 'certificate-files', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Staff can view private certificate files"
on storage.objects for select to authenticated
using (bucket_id = 'certificate-files' and public.is_active_staff());

create policy "Staff can upload certificate files with MFA"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'certificate-files'
  and public.is_active_staff(array['owner','admin','staff']::public.staff_role[])
  and (select auth.jwt()->>'aal') = 'aal2'
);

create policy "Staff can replace certificate files with MFA"
on storage.objects for update to authenticated
using (
  bucket_id = 'certificate-files'
  and public.is_active_staff(array['owner','admin','staff']::public.staff_role[])
  and (select auth.jwt()->>'aal') = 'aal2'
)
with check (
  bucket_id = 'certificate-files'
  and public.is_active_staff(array['owner','admin','staff']::public.staff_role[])
  and (select auth.jwt()->>'aal') = 'aal2'
);

-- Bootstrap exactly one owner after creating the first Auth user:
-- insert into public.staff_profiles(user_id,email,display_name,role,created_by)
-- select id,email,'DIFL Owner','owner',id from auth.users where email='OWNER_EMAIL';
