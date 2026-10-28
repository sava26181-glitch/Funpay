-- v17: последний визит, безопасные внешние ключи для решений по спорам, признак автопроверки лотов
alter table users add column if not exists last_seen timestamptz;
alter table listings add column if not exists mod_reason text;
do $$ begin
  alter table disputes drop constraint if exists disputes_resolved_by_fkey;
  alter table disputes add constraint disputes_resolved_by_fkey foreign key (resolved_by) references users(id) on delete set null;
exception when others then null; end $$;
do $$ begin
  alter table withdrawals drop constraint if exists withdrawals_resolved_by_fkey;
  alter table withdrawals add constraint withdrawals_resolved_by_fkey foreign key (resolved_by) references users(id) on delete set null;
exception when others then null; end $$;
alter table users add column if not exists block_hours int;
do $$ begin
  alter table withdrawals drop constraint if exists withdrawals_status_check;
  alter table withdrawals add constraint withdrawals_status_check check(status in('pending','processing','paid','rejected'));
exception when others then null; end $$;
create index if not exists i_users_seen on users(last_seen);
update games set is_active=false where slug='prochie-igry';
