-- v4: новости, час распродажи, кодекс продавца, битвы магазинов, совместная покупка
do $$ begin
  if exists (select 1 from pg_constraint where conrelid='media'::regclass and conname='media_kind_check') then alter table media drop constraint media_kind_check; end if;
  alter table media add constraint media_kind_check check(kind in('avatar','cover','listing','news'));
exception when duplicate_object then null; end $$;
create table if not exists news(id uuid primary key default gen_random_uuid(),author_id uuid references users on delete set null,title text not null check(char_length(title) between 3 and 120),body text not null default '' check(char_length(body)<=4000),media_ids uuid[] not null default '{}',created_at timestamptz not null default now());
create index if not exists i_news on news(created_at desc);
create table if not exists flash_sales(id uuid primary key default gen_random_uuid(),listing_id uuid not null references listings on delete cascade,seller_id uuid not null references users on delete cascade,percent int not null check(percent between 5 and 70),base_cents int not null check(base_cents>0),starts_at timestamptz not null default now(),ends_at timestamptz not null,cancelled_at timestamptz,created_at timestamptz not null default now());
create index if not exists i_fs_l on flash_sales(listing_id,ends_at desc);
create index if not exists i_fs_s on flash_sales(seller_id,ends_at desc);
create table if not exists seller_codes(user_id uuid primary key references users on delete cascade,version int not null default 1,signed_at timestamptz not null default now(),revoked_at timestamptz,mark text check(mark in('violation','scam')),reason text,revoked_by uuid references users on delete set null);
create table if not exists battle_optin(user_id uuid not null references users on delete cascade,category_id uuid not null references categories on delete cascade,created_at timestamptz not null default now(),primary key(user_id,category_id));
create table if not exists battles(id uuid primary key default gen_random_uuid(),category_id uuid not null references categories,week_start timestamptz not null,created_at timestamptz not null default now(),seller_a uuid not null references users on delete cascade,seller_b uuid not null references users on delete cascade,status text not null default 'live' check(status in('live','done')),score_a int,score_b int,winner_id uuid references users on delete set null,finished_at timestamptz,check(seller_a<>seller_b));
create index if not exists i_b_w on battles(week_start,category_id);
create index if not exists i_b_win on battles(winner_id,finished_at desc);
alter table listings add column if not exists allow_group boolean not null default false;
create table if not exists group_buys(id uuid primary key default gen_random_uuid(),listing_id uuid not null references listings on delete cascade,initiator_id uuid not null references users on delete cascade,partner_id uuid references users on delete set null,qty int not null default 1 check(qty between 1 and 100),unit_cents int not null check(unit_cents>0),total_cents bigint not null check(total_cents>0),initiator_pct int not null check(initiator_pct between 10 and 90),terms text not null default '' check(char_length(terms)<=500),status text not null default 'open' check(status in('open','ordered','cancelled','expired')),order_id uuid references orders on delete set null,expires_at timestamptz not null,created_at timestamptz not null default now());
create index if not exists i_gb_l on group_buys(listing_id,status);
alter table orders add column if not exists partner_id uuid references users;
alter table orders add column if not exists partner_cents bigint;
create index if not exists i_o_p on orders(partner_id);
-- самолечение внешних ключей: в старых базах они могли ссылаться не на users
do $$ declare r record; begin
  for r in select * from (values
    ('listings','seller_id'),('conversations','buyer_id'),('conversations','seller_id'),('messages','sender_id'),
    ('orders','buyer_id'),('orders','seller_id'),('orders','partner_id'),('reviews','reviewer_id'),('reviews','seller_id'),
    ('favorites','user_id'),('disputes','opened_by'),('reports','reporter_id')) v(t,c) loop
    begin
      if exists (select 1 from information_schema.columns where table_name=r.t and column_name=r.c) and exists (
        select 1 from pg_constraint k where k.contype='f' and k.conrelid=r.t::regclass and k.conkey=array[(select attnum from pg_attribute where attrelid=r.t::regclass and attname=r.c)]::int2[] and k.confrelid<>'users'::regclass) then
        execute format('alter table %I drop constraint %I', r.t, (select k.conname from pg_constraint k where k.contype='f' and k.conrelid=r.t::regclass and k.conkey=array[(select attnum from pg_attribute where attrelid=r.t::regclass and attname=r.c)]::int2[] and k.confrelid<>'users'::regclass limit 1));
        execute format('alter table %I add constraint %I foreign key (%I) references users(id) not valid', r.t, r.t||'_'||r.c||'_users_fk', r.c);
      end if;
    exception when others then null;
    end;
  end loop;
end $$;
