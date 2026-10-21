-- Coq Civique : effacement automatique des données après 3 ans (promis dans la politique de confidentialité).
-- À EXÉCUTER UNE FOIS dans Supabase → SQL Editor (coller ce fichier puis « Run »).
-- Chaque nuit à 3 h 17 (UTC), supprime :
--   - les adresses email (et leur progression) inactives depuis 3 ans ;
--   - les résultats d'examen déclarés depuis plus de 3 ans ;
--   - les statistiques de visite de plus de 3 ans.

create extension if not exists pg_cron;

create or replace function public.coq_effacement_automatique()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.learners where greatest(created_at, updated_at) < now() - interval '3 years';
  delete from public.exam_reports where created_at < now() - interval '3 years';
  delete from public.page_views where day < current_date - interval '3 years';
end;
$$;
revoke all on function public.coq_effacement_automatique() from public, anon, authenticated;

select cron.schedule('coq-effacement-3-ans', '17 3 * * *', 'select public.coq_effacement_automatique()');
