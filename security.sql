-- Sicherheits-Update für den Reise-App
-- In Supabase: SQL Editor > New query > alles einfügen > Run. Kann gefahrlos mehrfach ausgeführt werden.

-- 1) Redaktion nur mit bestätigter E-Mail aus der echten Nutzertabelle
--    (nicht mehr nur aus dem Login-Token), damit niemand sich mit fremder Adresse durchmogeln kann.
create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1
    from auth.users u
    join public.editors e on lower(e.email) = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to anon, authenticated;

-- 2) Spam-Bremse für Kommentare: max. 5 pro Beitrag und Minute, max. 200 pro Stunde insgesamt.
--    Zeitstempel setzt immer der Server.
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comments where post_id = new.post_id and created_at > now() - interval '1 minute') >= 5
     or (select count(*) from public.comments where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Too many comments, please try again later.';
  end if;
  new.created_at := now();
  new.name := btrim(new.name);
  new.body := btrim(new.body);
  if char_length(new.name) = 0 or char_length(new.body) = 0 then
    raise exception 'Empty comment';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_comment on public.comments;
create trigger trg_guard_comment before insert on public.comments for each row execute function public.guard_comment();

-- 3) Spam-Bremse für Reaktionen: max. 60 pro Beitrag und Minute, max. 2.000 pro Stunde insgesamt.
create or replace function public.guard_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reactions where post_id = new.post_id and created_at > now() - interval '1 minute') >= 60
     or (select count(*) from public.reactions where created_at > now() - interval '1 hour') >= 2000 then
    raise exception 'Too many reactions, please try again later.';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_guard_reaction on public.reactions;
create trigger trg_guard_reaction before insert on public.reactions for each row execute function public.guard_reaction();

-- 4) Zeitstempel von Beiträgen setzt der Server
create or replace function public.guard_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.created_at := now(); else new.created_at := old.created_at; end if;
  return new;
end $$;
drop trigger if exists trg_guard_post on public.posts;
create trigger trg_guard_post before insert or update on public.posts for each row execute function public.guard_post();

-- 5) Fotospeicher: nur Bilder und Videos, max. 50 MB
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/webm'],
    file_size_limit = 52428800
where id = 'media';

-- 6) Kontrolle: zeigt alle Redaktions-Adressen
select email from public.editors;
