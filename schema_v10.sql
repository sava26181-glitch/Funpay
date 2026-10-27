alter table listings add column if not exists deactivate_on_sale boolean not null default false;
create table if not exists pins(
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games on delete cascade,
  category_id uuid references categories on delete cascade,
  seller_id uuid not null references users on delete cascade,
  listing_ids uuid[] not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null
);
create index if not exists pins_active on pins(game_id,category_id,ends_at desc);
