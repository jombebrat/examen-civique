-- Coq Civique : résultats déclarés et témoignages, mesure d'audience anonyme, protection contre les abus.
-- Déjà appliquée au projet Supabase « coq-civique ».

-- 1. Résultats d'examen déclarés par les visiteurs. Un témoignage n'est affiché que si la personne
--    l'a autorisé (publication) ET si l'éditeur l'a validé (publie = true, à cocher dans Table Editor).
create table if not exists public.exam_reports (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  liste       text not null check (liste in ('nat', 'cr', 'csp')),
  reussi      boolean not null,
  score       smallint check (score between 0 and 40),
  prenom      text check (char_length(prenom) <= 40),
  temoignage  text check (char_length(temoignage) <= 600),
  publication boolean not null default false,
  publie      boolean not null default false
);
alter table public.exam_reports enable row level security;
revoke all on public.exam_reports from anon, authenticated;

create or replace function public.coq_resultat(p_liste text, p_reussi boolean, p_score integer default null,
  p_prenom text default null, p_temoignage text default null, p_publication boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.exam_reports where created_at > now() - interval '10 minutes') >= 200 then
    raise exception 'trop de demandes, réessayez plus tard';
  end if;
  insert into public.exam_reports (liste, reussi, score, prenom, temoignage, publication)
  values (p_liste, coalesce(p_reussi, false), p_score,
          nullif(trim(left(coalesce(p_prenom, ''), 40)), ''),
          nullif(trim(left(coalesce(p_temoignage, ''), 600)), ''),
          coalesce(p_publication, false));
end;
$$;

-- 2. Mesure d'audience anonyme : nombre de pages vues par jour, page et site d'origine. Aucune donnée personnelle.
create table if not exists public.page_views (
  day  date not null default current_date,
  path text not null check (char_length(path) <= 200),
  ref  text not null default '' check (char_length(ref) <= 100),
  n    integer not null default 0,
  primary key (day, path, ref)
);
alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;

create or replace function public.coq_vue(p_path text, p_ref text default '')
returns void language sql security definer set search_path = '' as $$
  insert into public.page_views (day, path, ref, n)
  values (current_date, left(coalesce(nullif(p_path, ''), '/'), 200), left(coalesce(p_ref, ''), 100), 1)
  on conflict (day, path, ref) do update set n = public.page_views.n + 1;
$$;

-- 3. Chiffres publics : totaux et témoignages validés uniquement
create or replace function public.coq_chiffres()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'inscrits',  (select count(*) from public.learners),
    'resultats', (select count(*) from public.exam_reports),
    'reussites', (select count(*) from public.exam_reports where reussi),
    'temoignages', coalesce((
      select jsonb_agg(jsonb_build_object('prenom', t.prenom, 'texte', t.temoignage, 'score', t.score, 'liste', t.liste) order by t.created_at desc)
      from (select * from public.exam_reports
            where publie and publication and temoignage is not null
            order by created_at desc limit 6) t), '[]'::jsonb)
  );
$$;

-- 4. Protection : pas plus de 300 nouvelles adresses en 10 minutes
create or replace function public.coq_open(p_email text, p_newsletter boolean default false, p_page text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e text := lower(trim(p_email));
  d jsonb;
begin
  if not exists (select 1 from public.learners where email = e)
     and (select count(*) from public.learners where created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'trop de demandes, réessayez plus tard';
  end if;
  insert into public.learners (email, newsletter, newsletter_at, page)
  values (e, coalesce(p_newsletter, false), case when coalesce(p_newsletter, false) then now() end, left(p_page, 200))
  on conflict (email) do update
    set newsletter = public.learners.newsletter or excluded.newsletter,
        newsletter_at = coalesce(public.learners.newsletter_at, excluded.newsletter_at)
  returning data into d;
  return d;
end;
$$;

revoke all on function public.coq_resultat(text, boolean, integer, text, text, boolean) from public;
revoke all on function public.coq_vue(text, text) from public;
revoke all on function public.coq_chiffres() from public;
grant execute on function public.coq_resultat(text, boolean, integer, text, text, boolean) to anon, authenticated;
grant execute on function public.coq_vue(text, text) to anon, authenticated;
grant execute on function public.coq_chiffres() to anon, authenticated;
