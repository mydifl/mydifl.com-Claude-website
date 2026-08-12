-- Bound untrusted record sizes and restrict recorded private-storage paths.
-- Browser validation remains useful UX, but these rules enforce limits at the
-- trusted database/storage boundary even when a client bypasses the UI.

alter table public.staff_profiles
  add constraint staff_profiles_email_length check (char_length(email) between 3 and 254),
  add constraint staff_profiles_display_name_length check (char_length(display_name) between 2 and 100);

alter table public.certificates
  add constraint certificates_number_format check (
    char_length(certificate_number) between 1 and 80
    and certificate_number ~ '^[A-Z0-9/_-]+$'
  ),
  add constraint certificates_student_name_length check (char_length(student_name) between 1 and 160),
  add constraint certificates_mobile_length check (mobile is null or char_length(mobile) <= 40),
  add constraint certificates_email_length check (email is null or char_length(email) <= 254),
  add constraint certificates_address_length check (contact_address is null or char_length(contact_address) <= 600),
  add constraint certificates_course_length check (char_length(course_name) between 1 and 160),
  add constraint certificates_language_length check (char_length(language) between 1 and 80),
  add constraint certificates_level_length check (level is null or char_length(level) <= 80),
  add constraint certificates_status_note_length check (status_note is null or char_length(status_note) <= 300),
  add constraint certificates_file_path_length check (file_path is null or char_length(file_path) <= 500),
  add constraint certificates_file_path_format check (
    file_path is null or file_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$'
  ),
  add constraint certificates_file_name_length check (file_name is null or char_length(file_name) <= 255),
  add constraint certificates_file_hash_format check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$');

alter table public.certificate_attachments
  add constraint certificate_attachments_path_length check (char_length(file_path) between 40 and 500),
  add constraint certificate_attachments_path_format check (
    file_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(certificate-|photo-|other-)[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$'
  ),
  add constraint certificate_attachments_name_length check (char_length(file_name) between 1 and 255),
  add constraint certificate_attachments_hash_format check (file_sha256 ~ '^[a-f0-9]{64}$');
