-- ===== категории игр (проверено по funpay.com; остальное помечено source='manual') =====
alter table game_categories add column if not exists label text, add column if not exists sort int not null default 0, add column if not exists source text not null default 'manual';
insert into categories(slug,name) values
 ('cases','Кейсы'),('prime','Prime'),('faceit','FACEIT Premium'),('arsenal','Арсенал'),('vhs','Привязки VHS'),('calibration','Калибровка'),('mmr-wash','Отмыв ЛП'),('dota-plus','Услуги Dota+'),
 ('pve','PvE'),('quests','Квесты'),('farm','Фарм'),('leveling','Прокачка'),('explore','Исследование локаций'),('bosses','Боссы и подземелья'),('achievements','Достижения'),
 ('edu','Обучение'),('pass','Боевой пропуск'),('ranked','Квалификация'),('gamepass','Game Pass'),('offline','Оффлайн активации'),('stars','Звёзды'),('channels','Каналы')
 on conflict (slug) do nothing;
insert into game_categories(game_id,category_id,label,sort,source)
select g.id,c.id,v.label,v.sort,v.src from (values
 ('cs2','accounts','Аккаунты',1,'funpay'),('cs2','prime','Prime',2,'funpay'),('cs2','faceit','FACEIT Premium',3,'funpay'),('cs2','arsenal','Арсенал',4,'funpay'),('cs2','skins','Скины',5,'funpay'),('cs2','cases','Кейсы',6,'funpay'),('cs2','boost','Буст',7,'funpay'),('cs2','edu','Обучение',8,'funpay'),('cs2','other','Прочее',9,'funpay'),
 ('dota2','accounts','Аккаунты',1,'funpay'),('dota2','vhs','Привязки VHS',2,'funpay'),('dota2','items','Предметы',3,'funpay'),('dota2','boost','Буст MMR',4,'funpay'),('dota2','calibration','Калибровка',5,'funpay'),('dota2','mmr-wash','Отмыв ЛП',6,'funpay'),('dota2','edu','Обучение',7,'funpay'),('dota2','dota-plus','Услуги Dota+',8,'funpay'),('dota2','other','Прочее',9,'funpay'),
 ('fortnite','accounts','Аккаунты',1,'funpay'),('fortnite','currency','В-баксы',2,'funpay'),('fortnite','donat','Донат',3,'funpay'),('fortnite','pve','PvE',4,'funpay'),('fortnite','services','Услуги',5,'funpay'),('fortnite','boost','Буст',6,'funpay'),('fortnite','twitch-drops','Twitch Drops',7,'funpay'),('fortnite','other','Прочее',8,'funpay'),
 ('genshin','accounts','Аккаунты',1,'funpay'),('genshin','currency','Кристаллы сотворения',2,'funpay'),('genshin','donat','Донат',3,'funpay'),('genshin','subscriptions','Луна',4,'funpay'),('genshin','leveling','Прокачка',5,'funpay'),('genshin','farm','Фарм',6,'funpay'),('genshin','explore','Исследование локаций',7,'funpay'),('genshin','bosses','Боссы и подземелья',8,'funpay'),('genshin','quests','Квесты',9,'funpay'),('genshin','twitch-drops','Twitch Drops',10,'funpay'),('genshin','achievements','Достижения',11,'funpay'),('genshin','other','Прочее',12,'funpay'),
 ('gta','accounts','Аккаунты',1,'funpay'),('gta','currency','Деньги (Online) / вирты (RP)',2,'funpay'),('gta','keys','Ключи',3,'funpay'),('gta','donat','Донат (RP)',4,'funpay'),('gta','items','Предметы (RP)',5,'funpay'),('gta','services','Услуги',6,'funpay'),('gta','subscriptions','GTA+',7,'funpay'),('gta','gamepass','Game Pass',8,'funpay'),('gta','twitch-drops','Twitch Drops',9,'funpay'),('gta','other','Прочее',10,'funpay'),
 ('hsr','accounts','Аккаунты',1,'funpay'),('hsr','donat','Донат',2,'funpay'),('hsr','services','Услуги',3,'funpay'),('hsr','explore','Исследование локаций',4,'funpay'),('hsr','twitch-drops','Twitch Drops',5,'funpay'),('hsr','other','Прочее',6,'funpay'),
 ('lol','currency','Riot Points',1,'funpay'),('lol','accounts','Аккаунты',2,'funpay'),('lol','donat','Донат',3,'funpay'),('lol','boost','Буст',4,'funpay'),('lol','services','Услуги',5,'funpay'),('lol','ranked','Квалификация',6,'funpay'),('lol','edu','Обучение',7,'funpay'),('lol','pass','Боевой пропуск',8,'funpay'),('lol','other','Прочее',9,'funpay'),
 -- ниже: не удалось проверить на funpay.com из окружения разработки (source='manual'), сверьте вручную
 ('minecraft','accounts','Аккаунты',1,'manual'),('minecraft','keys','Ключи',2,'manual'),('minecraft','items','Предметы',3,'manual'),('minecraft','services','Услуги',4,'manual'),('minecraft','other','Прочее',5,'manual'),
 ('roblox','accounts','Аккаунты',1,'manual'),('roblox','currency','Робуксы',2,'manual'),('roblox','items','Предметы',3,'manual'),('roblox','services','Услуги',4,'manual'),('roblox','other','Прочее',5,'manual'),
 ('pubg','accounts','Аккаунты',1,'manual'),('pubg','keys','Ключи',2,'manual'),('pubg','services','Услуги',3,'manual'),('pubg','other','Прочее',4,'manual'),
 ('pubg-mobile','accounts','Аккаунты',1,'manual'),('pubg-mobile','currency','UC',2,'manual'),('pubg-mobile','donat','Донат',3,'manual'),('pubg-mobile','services','Услуги',4,'manual'),('pubg-mobile','other','Прочее',5,'manual'),
 ('valorant','accounts','Аккаунты',1,'manual'),('valorant','currency','Valorant Points',2,'manual'),('valorant','boost','Буст',3,'manual'),('valorant','services','Услуги',4,'manual'),('valorant','edu','Обучение',5,'manual'),('valorant','other','Прочее',6,'manual'),
 ('wow','currency','Золото',1,'manual'),('wow','accounts','Аккаунты',2,'manual'),('wow','items','Предметы',3,'manual'),('wow','boost','Буст',4,'manual'),('wow','services','Услуги',5,'manual'),('wow','other','Прочее',6,'manual'),
 ('war-thunder','accounts','Аккаунты',1,'manual'),('war-thunder','currency','Золотые орлы',2,'manual'),('war-thunder','services','Услуги',3,'manual'),('war-thunder','other','Прочее',4,'manual'),
 ('steam','accounts','Аккаунты с играми',1,'manual'),('steam','keys','Ключи',2,'manual'),('steam','gifts','Подарки',3,'manual'),('steam','topup','Пополнение баланса',4,'manual'),('steam','other','Прочее',5,'manual'),
 ('playstation','accounts','Аккаунты',1,'manual'),('playstation','gifts','Подарочные карты',2,'manual'),('playstation','subscriptions','Подписки',3,'manual'),('playstation','keys','Ключи',4,'manual'),('playstation','other','Прочее',5,'manual'),
 ('xbox','accounts','Аккаунты',1,'manual'),('xbox','gifts','Подарочные карты',2,'manual'),('xbox','subscriptions','Подписки (Game Pass)',3,'manual'),('xbox','keys','Ключи',4,'manual'),('xbox','other','Прочее',5,'manual'),
 ('telegram','subscriptions','Подписка',1,'manual'),('telegram','gifts','Подарки',2,'manual'),('telegram','stars','Звёзды',3,'manual'),('telegram','channels','Каналы',4,'manual'),('telegram','services','Услуги',5,'manual')
) v(g,c,label,sort,src) join games g on g.slug=v.g join categories c on c.slug=v.c
on conflict (game_id,category_id) do update set label=excluded.label,sort=excluded.sort,source=excluded.source;

-- ===== уведомления, история цены, отслеживание =====
create table if not exists notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references users on delete cascade,type text not null,payload jsonb not null default '{}'::jsonb,read_at timestamptz,created_at timestamptz not null default now());
create index if not exists i_notif_u on notifications(user_id,created_at desc);
create table if not exists price_history(id bigint generated always as identity primary key,listing_id uuid not null references listings on delete cascade,price_cents integer not null,created_at timestamptz not null default now());
create index if not exists i_ph on price_history(listing_id,created_at);
insert into price_history(listing_id,price_cents,created_at) select l.id,l.price_cents,l.created_at from listings l where not exists (select 1 from price_history h where h.listing_id=l.id);
create table if not exists price_watch(user_id uuid not null references users on delete cascade,listing_id uuid not null references listings on delete cascade,last_seen_cents integer not null,target_cents integer,created_at timestamptz not null default now(),primary key(user_id,listing_id));
create or replace function track_price() returns trigger language plpgsql as $$ begin
  if tg_op='INSERT' or new.price_cents is distinct from old.price_cents then insert into price_history(listing_id,price_cents) values(new.id,new.price_cents); end if; return new; end $$;
drop trigger if exists listings_price on listings;
create trigger listings_price after insert or update of price_cents on listings for each row execute function track_price();
create or replace function notify_price() returns trigger language plpgsql as $$ begin
  if new.status='active' and (tg_op='INSERT' or new.price_cents is distinct from old.price_cents or old.status is distinct from 'active') then
    insert into notifications(user_id,type,payload)
      select w.user_id,'price_drop',jsonb_build_object('listing_id',new.id,'title',new.title,'old',w.last_seen_cents,'new',new.price_cents)
      from price_watch w where w.listing_id=new.id and new.price_cents<w.last_seen_cents and (w.target_cents is null or new.price_cents<=w.target_cents) and w.user_id<>new.seller_id;
    update price_watch set last_seen_cents=new.price_cents where listing_id=new.id and last_seen_cents<>new.price_cents;
  end if; return new; end $$;
drop trigger if exists listings_notify on listings;
create trigger listings_notify after insert or update of price_cents,status on listings for each row execute function notify_price();

-- ===== перевод чата (кэш) и видео выдачи =====
create table if not exists translations(hash text not null,target text not null,translated text not null,detected text,created_at timestamptz not null default now(),primary key(hash,target));
alter table attachments drop constraint if exists attachments_context_check;
alter table attachments add constraint attachments_context_check check(context in('chat','ticket','dispute','delivery'));

alter table listings add column if not exists after_msg text;
