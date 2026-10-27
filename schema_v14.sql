-- автовыдача: секретные позиции лежат только на сервере и уходят покупателю после оплаты
alter table listings add column if not exists auto_items text[];
alter table listings add column if not exists auto_delivery boolean not null default false;
alter table orders add column if not exists delivered text;
