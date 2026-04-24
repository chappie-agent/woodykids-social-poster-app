-- supabase/seed.sql
insert into settings (id, tone_of_voice) values (1, '') on conflict do nothing;

insert into posts (state, position)
select 'empty', gs
from generate_series(0, 11) gs
where not exists (select 1 from posts);
