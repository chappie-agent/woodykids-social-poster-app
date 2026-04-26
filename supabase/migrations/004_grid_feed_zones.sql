-- supabase/migrations/004_grid_feed_zones.sql

-- 1. Verwijder alle niet-locked rijen (concepten leven vanaf nu in de browser).
delete from posts where state <> 'locked';

-- 2. Voeg kolom voor Zernio post-id toe (nullable, want oude rijen kennen 'm niet).
alter table posts add column if not exists zernio_post_id text;

-- 3. Versmal de state-check tot alleen 'locked'.
alter table posts drop constraint if exists posts_state_check;
alter table posts add constraint posts_state_check check (state = 'locked');

-- 4. position is irrelevant voor locked posts (sortering volgt scheduled_at).
--    Maak nullable en drop unique-constraint zodat we 'm niet meer hoeven te zetten.
alter table posts alter column position drop not null;
alter table posts drop constraint if exists posts_position_key;
