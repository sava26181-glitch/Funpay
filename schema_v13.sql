-- час распродажи отключён: закрываем все активные
update flash_sales set cancelled_at=now() where cancelled_at is null;
-- единая история: системные сообщения о заказах живут в обычном чате
alter table messages add column if not exists kind text not null default 'user';
alter table messages add column if not exists order_id uuid references orders on delete set null;
alter table messages add column if not exists ev text;
insert into conversations(buyer_id,seller_id) select distinct o.buyer_id,o.seller_id from orders o where not exists(select 1 from conversations c where least(c.buyer_id,c.seller_id)=least(o.buyer_id,o.seller_id) and greatest(c.buyer_id,c.seller_id)=greatest(o.buyer_id,o.seller_id)) on conflict do nothing;
insert into messages(conversation_id,sender_id,body,created_at,read_at,kind,order_id,ev)
select c.id,case e.status when 'in_progress' then o.seller_id else o.buyer_id end,
 case e.status
  when 'paid' then 'Заказ #'||o.number||' оплачен покупателем '||b.username||'. '||l.title||'. '||s.username||', выдайте товар. '||b.username||', после получения нажмите «Подтвердить выполнение заказа».'
  when 'in_progress' then 'Продавец '||s.username||' приступил к выполнению заказа #'||o.number||'.'
  when 'completed' then b.username||' подтвердил выполнение заказа #'||o.number||'. Деньги переведены продавцу '||s.username||'.'
  when 'cancelled' then 'Заказ #'||o.number||' отменён.'
  else 'По заказу #'||o.number||' открыт спор. Модератор подключится и увидит переписку в этом чате.' end,
 e.created_at,e.created_at,'system',o.id,e.status
from order_events e join orders o on o.id=e.order_id join listings l on l.id=o.listing_id join users b on b.id=o.buyer_id join users s on s.id=o.seller_id
join conversations c on least(c.buyer_id,c.seller_id)=least(o.buyer_id,o.seller_id) and greatest(c.buyer_id,c.seller_id)=greatest(o.buyer_id,o.seller_id)
where e.status in('paid','in_progress','completed','cancelled','dispute')
 and not exists(select 1 from messages m where m.order_id=o.id and m.ev=e.status)
 and not exists(select 1 from messages m where e.status='paid' and m.conversation_id=c.id and m.body like 'Заказ #'||o.number||' оплачен%');
-- промокоды
create table if not exists promo_codes(id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[A-Z0-9_-]{3,32}$'),kind text not null default 'percent' check(kind in('percent','fixed')),value numeric(14,2) not null check(value>0),max_discount_cents bigint,min_order_cents bigint not null default 0,max_order_cents bigint,max_uses int,uses int not null default 0,per_user int not null default 1,expires_at timestamptz,active boolean not null default true,created_by uuid references users,created_at timestamptz not null default now());
create table if not exists promo_uses(id bigint generated always as identity primary key,promo_id uuid not null references promo_codes on delete cascade,user_id uuid not null references users on delete cascade,order_id uuid not null unique references orders on delete cascade,discount_cents bigint not null,created_at timestamptz not null default now());
alter table orders add column if not exists discount_cents bigint not null default 0;
alter table orders add column if not exists promo_id uuid references promo_codes on delete set null;
-- дуэли по играм
alter table duel_queue add column if not exists game_id uuid references games on delete cascade;
alter table duels add column if not exists game_id uuid references games;
create table if not exists duel_auto(user_id uuid not null references users on delete cascade,game_id uuid not null references games on delete cascade,category_id uuid not null references categories on delete cascade,created_at timestamptz not null default now(),primary key(user_id,game_id,category_id));
