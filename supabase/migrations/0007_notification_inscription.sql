-- Coq Civique : notification sur le téléphone de l'éditeur à chaque nouvelle adresse email (application ntfy).
-- Le message ne contient aucune donnée personnelle : seulement le nombre total d'adresses enregistrées.
-- Le nom du canal ntfy et le lien de la page d'administration sont gardés dans Supabase Vault
-- (secrets « ntfy_topic » et « admin_url »), jamais dans ce dépôt public. Sans secret « ntfy_topic », rien n'est envoyé.

create extension if not exists pg_net;

create or replace function public.coq_notifier_inscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  canal text;
  lien text;
  total integer;
begin
  select decrypted_secret into canal from vault.decrypted_secrets where name = 'ntfy_topic' limit 1;
  if canal is null then
    return new;
  end if;
  select decrypted_secret into lien from vault.decrypted_secrets where name = 'admin_url' limit 1;
  select count(*) into total from public.learners;
  perform net.http_post(
    url := 'https://ntfy.sh',
    body := jsonb_strip_nulls(jsonb_build_object(
      'topic', canal,
      'title', 'Coq Civique: nova prijava',
      'message', format('Neko je upravo sačuvao napredak emailom. Ukupno adresa: %s.', total),
      'tags', jsonb_build_array('rooster'),
      'click', lien
    )),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
exception when others then
  -- Une notification ratée ne doit jamais empêcher quelqu'un d'enregistrer sa progression.
  return new;
end;
$$;

revoke all on function public.coq_notifier_inscription() from public, anon, authenticated;

drop trigger if exists coq_notifier_inscription on public.learners;
create trigger coq_notifier_inscription
  after insert on public.learners
  for each row execute function public.coq_notifier_inscription();
