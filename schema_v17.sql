-- v18: огонь в названиях игр, показ ачивок, заморозка денег продавца при споре
update games set name=trim(regexp_replace(name,'\s*🔥\s*',' ','g')) where name like '%🔥%';
alter table users add column if not exists show_badges boolean not null default true;
alter table ledger_entries drop constraint if exists ledger_entries_kind_check;
alter table ledger_entries add constraint ledger_entries_kind_check check(kind in('topup','order_payment','order_payout','refund','adjustment','test_topup','withdraw','withdraw_refund','dispute_capture'));
create table if not exists holds(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders on delete cascade,
  user_id uuid not null references users on delete cascade,
  amount numeric(14,2) not null check(amount>=0),
  status text not null default 'held' check(status in('held','released','captured')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists holds_user_held on holds(user_id) where status='held';
