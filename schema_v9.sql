-- v9: вложения хранятся в базе, если Supabase Storage не настроен
create table if not exists attachment_blobs(attachment_id uuid primary key references attachments on delete cascade,data bytea not null);
