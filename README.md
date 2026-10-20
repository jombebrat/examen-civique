# Coq Civique — examen civique : les 259 questions et réponses

Site de révision pour l’examen civique (naturalisation), publié sur https://coqcivique.com : une page par question, une page par thème et une application de révision (cartes, quiz QCM, examen blanc de 40 questions en 45 minutes). Site statique publié sur GitHub Pages, sans compte ni cookie.

## Organisation

| Dossier / fichier | Rôle |
|---|---|
| `data/questions.json` | **Le contenu** : thèmes, questions, réponses, explications, propositions du QCM. C’est le seul fichier à modifier pour corriger une réponse. |
| `site.config.json` | Nom du site, slogan, éditeur (mentions légales). |
| `src/site/site.css` | Apparence des pages du site. |
| `src/app/app.html` | Application de révision (page `/reviser/`). |
| `assets/` | Polices (licence SIL OFL) et icône. |
| `scripts/validate.mjs` | Vérifie les données (lancé automatiquement avant chaque publication). |
| `scripts/build.mjs` | Génère le site dans `dist/`. |
| `.github/workflows/deploy.yml` | Vérifie, génère et publie le site à chaque modification de `main`. |

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

Avant une diffusion publique, renseigner `editeur` dans `site.config.json` (mentions légales obligatoires en France).

## Comptes et livret PDF (Supabase)

- `supabase/migrations/0001_comptes_et_livret.sql` : tables `progress` (progression de chaque compte) et `pdf_downloads` (demandes du livret), règles de sécurité (RLS) et fonction `delete_my_account()`.
- `supabase/emails/code-de-connexion.html` : modèle d’email (code à 6 chiffres) pour **Magic Link** et **Confirm signup**.
- Dans `site.config.json`, renseigner `supabase.url` et `supabase.cle_publique` (clé publique « anon/publishable », jamais la clé secrète). Sans ces deux valeurs, la connexion et le formulaire du livret sont masqués et le site fonctionne sans compte.
- Supabase n’envoie les emails à tous les utilisateurs qu’avec un service SMTP configuré (par exemple Brevo) : Authentication → Emails → SMTP Settings.

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
