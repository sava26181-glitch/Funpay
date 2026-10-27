alter table orders add column if not exists fee_cents bigint not null default 0;
alter table withdrawals add column if not exists fee numeric(14,2) not null default 0;
alter table duel_boosts add column if not exists fee_until timestamptz;
create table if not exists user_fp(user_id uuid not null references users on delete cascade,kind text not null check(kind in('ip','dev')),hash text not null,last_seen timestamptz not null default now(),primary key(user_id,kind,hash));
create index if not exists user_fp_hash on user_fp(kind,hash);
