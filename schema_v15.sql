-- отзывы: ответ продавца, правка отзыва
alter table reviews add column if not exists reply text;
alter table reviews add column if not exists reply_at timestamptz;
alter table reviews add column if not exists edited_at timestamptz;
