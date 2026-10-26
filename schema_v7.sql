-- v7: единый чат на пару, номера заказов, комментарии к новостям, сброс пароля, кастом карточки
alter table messages add column if not exists listing_id uuid references listings on delete set null;
update messages m set listing_id=c.listing_id from conversations c where c.id=m.conversation_id and m.listing_id is null and c.listing_id is not null;
do $$ declare r record; k uuid; begin
  for r in select least(buyer_id,seller_id) a, greatest(buyer_id,seller_id) b from conversations group by 1,2 having count(*)>1 loop
    select id into k from conversations where least(buyer_id,seller_id)=r.a and greatest(buyer_id,seller_id)=r.b order by created_at limit 1;
    update messages set conversation_id=k where conversation_id in (select id from conversations where least(buyer_id,seller_id)=r.a and greatest(buyer_id,seller_id)=r.b and id<>k);
    delete from conversations where least(buyer_id,seller_id)=r.a and greatest(buyer_id,seller_id)=r.b and id<>k;
  end loop;
end $$;
update conversations set listing_id=null where listing_id is not null;
create unique index if not exists conv_pair on conversations (least(buyer_id,seller_id), greatest(buyer_id,seller_id));

alter table orders add column if not exists number text;
update orders set number=upper(substr(md5(id::text),1,8)) where number is null;
alter table orders alter column number set default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
create unique index if not exists orders_number on orders(number);

create table if not exists news_comments(id uuid primary key default gen_random_uuid(),news_id uuid not null references news on delete cascade,user_id uuid not null references users on delete cascade,body text not null check(char_length(body) between 1 and 500),created_at timestamptz not null default now());
create index if not exists i_nc on news_comments(news_id,created_at);

create table if not exists pw_resets(id uuid primary key default gen_random_uuid(),user_id uuid not null references users on delete cascade,code_hash text not null,kind text not null default 'telegram',tries int not null default 0,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now());
create index if not exists i_pw on pw_resets(user_id,created_at desc);

alter table listings add column if not exists card jsonb not null default '{}'::jsonb;
