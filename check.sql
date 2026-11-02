-- Sicherheits-Check: nur lesen, ändert nichts. Im SQL Editor ausführen und das Ergebnis anschauen.
-- Jede Zeile sollte bei "ok" ein ✅ zeigen.

with
rls as (
  select c.relname as tbl, c.relrowsecurity as on_
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
trg as (select tgname from pg_trigger where not tgisinternal),
fn as (select pg_get_functiondef('public.is_editor()'::regprocedure) as def),
bk as (select id, public, allowed_mime_types from storage.buckets)
select * from (values
  ('RLS auf allen Tabellen aktiv', (select bool_and(on_) from rls)::text, (select bool_and(on_) from rls)),
  ('Tabellen ohne RLS', coalesce((select string_agg(tbl, ', ') from rls where not on_), '–'), not exists (select 1 from rls where not on_)),
  ('security.sql gelaufen: Redaktion nur mit bestätigter E-Mail', '', (select def like '%email_confirmed_at%' from fn)),
  ('Spam-Bremse Kommentare', '', exists (select 1 from trg where tgname = 'trg_guard_comment')),
  ('Spam-Bremse Reaktionen', '', exists (select 1 from trg where tgname = 'trg_guard_reaction')),
  ('Fotospeicher "media" nur Bilder/Videos', '', (select allowed_mime_types is not null from bk where id = 'media')),
  ('Belegspeicher "private" nicht öffentlich', '', (select not public from bk where id = 'private')),
  ('Redaktionsliste', (select string_agg(email, ', ') from public.editors), (select count(*) >= 1 from public.editors)),
  ('Nutzerkonten', (select string_agg(email || case when email_confirmed_at is null then ' (UNBESTÄTIGT)' else '' end, ', ') from auth.users), (select count(*) <= (select count(*) from public.editors) from auth.users)),
  ('Nutzer, die nicht in der Redaktion sind', coalesce((select string_agg(u.email, ', ') from auth.users u where not exists (select 1 from public.editors e where lower(e.email) = lower(u.email))), '–'),
     not exists (select 1 from auth.users u where not exists (select 1 from public.editors e where lower(e.email) = lower(u.email)))),
  ('Cockpit-Reisedaten vorhanden', '', exists (select 1 from public.cockpit_items where coll = 'private' and id = 'trip'))
) as t(pruefung, details, ok_bool)
cross join lateral (select case when ok_bool then '✅' else '❌' end as ok) x;
