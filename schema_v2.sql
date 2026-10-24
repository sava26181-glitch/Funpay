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
