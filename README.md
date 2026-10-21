# Coq Civique — examen civique : les 259 questions et réponses

Site de révision pour l’examen civique, publié sur https://coqcivique.com : les trois listes officielles de questions (naturalisation, carte de résident, carte de séjour pluriannuelle) avec une page par question, des guides, et une application de révision (cartes, QCM, examen blanc de 40 questions en 45 minutes). Site statique publié sur GitHub Pages ; compte facultatif et livret PDF via Supabase (voir plus bas).

## Organisation

| Dossier / fichier | Rôle |
|---|---|
| `data/questions.json` | **Les réponses** : thèmes, questions, réponses, explications, propositions du QCM. C’est le fichier à modifier pour corriger une réponse. |
| `data/listes.json` | Listes officielles carte de résident (CR) et carte de séjour pluriannuelle (CSP) : ordre, numéro et formulation exacte de chaque question, avec l’id de la question qui porte la réponse. |
| `data/situations.json` | Mises en situation (exercices rédigés par Coq Civique, non officiels), générées par `tools/situations/generer.py`. |
| `data/en.json` | Aide en anglais de l’application (bouton « EN ») : questions, réponses, explications et mises en situation. Générée par `python3 tools/en/generer.py` à partir des fichiers de `tools/en/`. |
| `content/guides/`, `content/pages/` | Guides et pages (À propos, plan en 7 jours, conditions d’utilisation) en HTML simple, avec un en-tête JSON (titre, description, date). |
| `content/en/` | Page en anglais (`/en/`), reliée à l’accueil par les balises hreflang. |
| `site.config.json` | Nom du site, éditeur (mentions légales), connexion Supabase. |
| `src/site/site.css` | Apparence des pages du site. |
| `src/site/coq.js` | Fenêtre « votre email », liens PDF, sauvegarde en ligne. |
| `src/app/app.html` | Application de révision (page `/reviser/`). |
| `assets/` | Logo et icônes, mascotte animée (`mascotte.*`), image de partage (`og-image.png`), polices (licence SIL OFL), livret PDF. |
| `scripts/validate.mjs` | Vérifie les données (lancé automatiquement avant chaque publication). |
| `scripts/build.mjs` | Génère le site dans `dist/`. |
| `.github/workflows/deploy.yml` | Vérifie, génère et publie le site à chaque modification de `main`. |

## Les trois listes

- **Naturalisation** : les questions dont l’id est « thème-numéro » (par exemple `1-17`) dans `data/questions.json`.
- **Carte de résident et CSP** : `data/listes.json`. Une question déjà présente dans la liste naturalisation est simplement référencée (avec sa formulation officielle si elle diffère) ; les questions propres à ces listes ont un id `csp-…` ou `cr-…` dans `data/questions.json`.
- Si le ministère modifie les listes : mettre à jour `data/sources/listes-csp-cr.txt` et les réponses dans `tools/listes/contenu_a.py` / `contenu_b.py`, puis lancer `python3 tools/listes/fusion.py`.
- Après une modification des questions ou des mises en situation, mettre à jour la traduction dans `tools/en/` (`nat_a.py`, `nat_b.py`, `new.py`, `sit.py`) puis lancer `python3 tools/en/generer.py` : le script s’arrête si une question n’a pas de traduction.

## Modifier un guide ou une page

Ouvrez le fichier dans `content/guides/` ou `content/pages/` (directement sur GitHub, icône crayon). Le texte est en HTML simple (`<p>`, `<h2>`, `<ul>`). Mettez à jour la date `"maj"` dans l’en-tête. Pour ajouter un guide, créez un nouveau fichier : il apparaît automatiquement dans `/guide/` et dans le sitemap. Raccourcis utilisables : `{{href:/reviser/}}` (lien interne), `{{nat}}`, `{{cr}}`, `{{csp}}` (nombre de questions), `{{contact}}`.

## Corriger ou modifier une question

Dans `data/questions.json`, chaque question ressemble à ceci :

```json
{
  "id": "1-17",
  "theme": 1,
  "numero": 17,
  "question": "Quelle est la devise de la République française ?",
  "reponse": "« Liberté, Égalité, Fraternité ».",
  "explication": "",
  "complement_hors_livret": "",
  "reponse_hors_livret": false,
  "livret_pages": "6",
  "qcm": {
    "bonne": "Liberté, Égalité, Fraternité",
    "mauvaises": ["Travail, Famille, Patrie", "Unie dans la diversité", "Paix, Justice, Progrès"]
  }
}
```

- `explication` : précisions tirées du Livret du citoyen.
- `complement_hors_livret` : information ajoutée qui ne figure pas dans le livret (affichée avec l’étiquette « hors livret »).
- `reponse_hors_livret` : `true` si la réponse elle-même ne vient pas du livret.
- `livret_pages` : pages du Livret du citoyen (édition mai 2026), par exemple `"8, 9"`.
- `qcm` : la bonne proposition et exactement 3 mauvaises, toutes différentes.

Écrivez le texte normalement : la typographie française (espaces insécables, exposants comme 1er ou XIXe) est ajoutée automatiquement.

Pour une petite correction, modifiez le fichier directement sur GitHub (icône crayon), puis validez. Le site se met à jour en une à deux minutes. Si les données contiennent une erreur, la publication s’arrête et l’onglet **Actions** indique la question concernée.

## Travailler sur son ordinateur

Il faut Node.js 22 ou plus récent ; aucune autre installation.

```bash
node scripts/validate.mjs          # vérifier les données
node scripts/build.mjs             # générer le site dans dist/
cd dist && python3 -m http.server  # le voir sur http://localhost:8000
```

## Mise en ligne

1. Dans **Settings → Pages**, choisir **Source : GitHub Actions**.
2. Chaque modification de la branche `main` publie le site.
3. Domaine personnalisé : **Settings → Pages → Custom domain**, puis les enregistrements DNS indiqués par GitHub. L’adresse du site est prise en compte automatiquement.

## Adresse email, progression et livret PDF (Supabase)

À l’arrivée sur le site, une fenêtre demande l’adresse email du visiteur (il peut choisir « Plus tard »). Il n’y a ni mot de passe ni code : la progression de révision est liée à l’adresse, et le livret PDF se télécharge dès qu’elle est indiquée. Le code est dans `src/site/coq.js` (fenêtre, liens PDF) et `src/app/app.html` (synchronisation).

Projet Supabase `coq-civique` (région Paris), déjà configuré ; les fichiers du dépôt servent de référence.

- `supabase/migrations/0003_progression_par_email.sql` et `0004_preuve_consentement.sql` : table `learners` (email, accord pour les nouvelles et sa date `newsletter_at`, progression) et fonctions `coq_open` / `coq_save`. La table n’est pas lisible depuis le site ; les deux fonctions sont le seul accès, ce que signalent (normalement) les avertissements « SECURITY DEFINER » de Supabase.
- Les adresses se consultent dans Supabase → Table Editor → `learners` (colonne `newsletter` = accord pour les nouvelles).
- `site.config.json` → `supabase` : adresse du projet, clé publique (« publishable », jamais la clé secrète) et `"actif"` (`false` pour tout désactiver).
- Anciens éléments non utilisés : tables `progress` et `pdf_downloads`, fonction `delete-account`, modèle `supabase/emails/` (connexion par code, si on veut un jour des comptes vérifiés).

## Régénérer le livret PDF

Le PDF (`assets/coq-civique-examen-civique.pdf`) est produit à partir de `data/questions.json` :

```bash
pip install playwright pypdf pdfplumber reportlab fonttools brotli
python3 tools/pdf/render_pdf.py      # crée le PDF
python3 tools/pdf/check_pdf.py assets/coq-civique-examen-civique.pdf   # vérifie les chevauchements
```
Après une modification importante des réponses, régénérer le PDF puis la vignette : `pdftoppm -r 40 -png -f 1 -l 1 -singlefile assets/coq-civique-examen-civique.pdf assets/livret-couverture`.

## Sources

- Liste officielle des questions de connaissance (naturalisation), ministère de l’Intérieur, 12 décembre 2025.
- Livret du citoyen, édition mai 2026, et Charte des droits et devoirs du citoyen français.

Site indépendant, non officiel.
