alter table users add column if not exists totp_secret text;
alter table users add column if not exists totp_enabled boolean not null default false;
alter table users add column if not exists totp_backup jsonb not null default '[]';
alter table users add column if not exists totp_last_step bigint;
