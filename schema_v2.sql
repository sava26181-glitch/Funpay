alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('user','moderator','admin','owner'));
alter table users add column if not exists blocked_until timestamptz, add column if not exists block_reason text,
  add column if not exists avatar_media uuid, add column if not exists cover_media uuid,
  add column if not exists theme jsonb not null default '{}'::jsonb, add column if not exists telegram_id bigint unique,
  add column if not exists seller_verified boolean not null default false;
alter table listings add column if not exists attrs jsonb not null default '{}'::jsonb, add column if not exists image_media uuid, add column if not exists mod_reason text;
insert into categories(slug,name) values('clans','Кланы'),('twitch-drops','Twitch Drops'),('donat','Донат') on conflict do nothing;
create table if not exists media(id uuid primary key default gen_random_uuid(),owner_id uuid not null references users on delete cascade,kind text not null check(kind in('avatar','cover','listing')),mime text not null,size int not null,data bytea not null,created_at timestamptz not null default now());
create index if not exists i_media_owner on media(owner_id,kind);
create table if not exists seller_verifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references users on delete cascade,token_hash text not null unique,expires_at timestamptz not null,used_at timestamptz,telegram_id bigint,status text not null default 'pending' check(status in('pending','awaiting_contact','verified','failed')),phone_last4 text,created_at timestamptz not null default now());
create table if not exists audit_log(id bigint generated always as identity primary key,actor_id uuid,action text not null,target_type text,target_id text,details jsonb,created_at timestamptz not null default now());
create table if not exists moderation_events(id bigint generated always as identity primary key,listing_id uuid references listings on delete cascade,actor_id uuid,status text not null,reason text,created_at timestamptz not null default now());
create table if not exists tickets(id uuid primary key default gen_random_uuid(),user_id uuid not null references users on delete cascade,order_id uuid references orders,category text not null check(category in('order','payment','account','listing','other')),subject text not null check(char_length(subject) between 3 and 120),status text not null default 'new' check(status in('new','in_review','awaiting_user','resolved','closed')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists ticket_messages(id bigint generated always as identity primary key,ticket_id uuid not null references tickets on delete cascade,author_id uuid references users,body text not null check(char_length(body) between 1 and 3000),internal boolean not null default false,created_at timestamptz not null default now());
create table if not exists dispute_messages(id bigint generated always as identity primary key,dispute_id uuid not null references disputes on delete cascade,author_id uuid references users,body text not null check(char_length(body) between 1 and 3000),internal boolean not null default false,created_at timestamptz not null default now());
create table if not exists wallets(user_id uuid primary key references users on delete cascade,currency text not null default 'RUB',balance numeric(14,2) not null default 0 check(balance>=0));
create table if not exists ledger_entries(id bigint generated always as identity primary key,user_id uuid not null references users,kind text not null check(kind in('topup','order_payment','order_payout','refund','adjustment')),amount numeric(14,2) not null,currency text not null default 'RUB',ref_type text,ref_id text,provider_event_id text unique,created_at timestamptz not null default now());
create or replace function forbid_change() returns trigger language plpgsql as $$ begin raise exception 'ledger is append-only'; end $$;
drop trigger if exists ledger_ro on ledger_entries;
create trigger ledger_ro before update or delete on ledger_entries for each row execute function forbid_change();
create index if not exists i_tk on tickets(user_id);
create index if not exists i_tm on ticket_messages(ticket_id);
create index if not exists i_dm on dispute_messages(dispute_id);
create index if not exists i_audit on audit_log(created_at desc);
alter table users add column if not exists admin_telegram_id bigint unique;
create table if not exists admin_link_tokens(id uuid primary key default gen_random_uuid(),user_id uuid not null references users on delete cascade,token_hash text not null unique,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now());
-- публичный порядковый номер: безопасная миграция существующих пользователей по дате регистрации
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='users' and column_name='public_id') then
    create sequence users_public_id_seq;
    alter table users add column public_id bigint;
    update users u set public_id=r.n from (select id,row_number() over (order by created_at,id) n from users) r where r.id=u.id;
    perform setval('users_public_id_seq',coalesce((select max(public_id) from users),0)+1,false);
    alter table users alter column public_id set default nextval('users_public_id_seq'), alter column public_id set not null;
    alter sequence users_public_id_seq owned by users.public_id;
    create unique index users_public_id_key on users(public_id);
  end if;
end $$;
create or replace function keep_public_id() returns trigger language plpgsql as $$ begin if new.public_id is distinct from old.public_id then raise exception 'public_id is immutable'; end if; return new; end $$;
drop trigger if exists users_keep_public_id on users;
create trigger users_keep_public_id before update on users for each row execute function keep_public_id();
alter table media alter column data drop not null;
alter table media add column if not exists storage_bucket text, add column if not exists storage_path text;
alter table disputes drop constraint if exists disputes_status_check;
alter table disputes add constraint disputes_status_check check(status in('open','in_review','awaiting_info','resolved_buyer','resolved_seller','closed'));
create table if not exists attachments(id uuid primary key default gen_random_uuid(),owner_id uuid not null references users on delete cascade,context text not null check(context in('chat','ticket','dispute')),ref_id text,bucket text not null,path text not null,mime text not null,size int not null,name text not null,message_id uuid references messages on delete cascade,ticket_message_id bigint references ticket_messages on delete cascade,dispute_message_id bigint references dispute_messages on delete cascade,created_at timestamptz not null default now());
create index if not exists i_att_m on attachments(message_id);
create index if not exists i_att_tm on attachments(ticket_message_id);
create index if not exists i_att_dm on attachments(dispute_message_id);
create index if not exists i_att_o on attachments(owner_id,created_at);
