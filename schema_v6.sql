-- v6: убрать «игры» без букв в названии (например '83), если на них нет лотов
delete from games g where g.name !~ '[A-Za-zА-Яа-яЁё]' and not exists (select 1 from listings l where l.game_id=g.id);
