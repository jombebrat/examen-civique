// Vérifie data/questions.json avant chaque publication. Code de sortie 1 en cas d'erreur.
import { loadJSON, questionSlugs } from "./lib.mjs";

const data = loadJSON("data/questions.json");
const listes = loadJSON("data/listes.json");
const config = loadJSON("site.config.json");
const errors = [], warnings = [];
const err = (id, msg) => errors.push(`[${id}] ${msg}`);

const themeIds = new Set();
for (const t of data.themes || []) {
  if (!Number.isInteger(t.id)) err("thème", `id invalide : ${t.id}`);
  if (themeIds.has(t.id)) err(`thème ${t.id}`, "id en double");
  themeIds.add(t.id);
  for (const f of ["slug", "titre", "titre_court"]) if (!t[f] || !String(t[f]).trim()) err(`thème ${t.id}`, `champ « ${f} » vide`);
  if (!/^[a-z0-9-]+$/.test(t.slug || "")) err(`thème ${t.id}`, `slug invalide : ${t.slug}`);
  if (!Array.isArray(t.essentiel) || !t.essentiel.length) err(`thème ${t.id}`, "« essentiel » doit contenir au moins une ligne");
}

const ids = new Set();
const expected = {};
for (const q of data.questions || []) {
  const id = q.id || "?";
  if (ids.has(id)) err(id, "id en double");
  ids.add(id);
  if (!themeIds.has(q.theme)) err(id, `thème inconnu : ${q.theme}`);
  const nat = /^[1-5]-\d+$/.test(id);
  if (nat) {
    // Liste « naturalisation » : numérotation continue par thème, id « thème-numéro »
    expected[q.theme] = (expected[q.theme] || 0) + 1;
    if (q.numero !== expected[q.theme]) err(id, `numéro ${q.numero} attendu ${expected[q.theme]} (les questions doivent se suivre)`);
    if (id !== `${q.theme}-${q.numero}`) err(id, `l'id doit être « ${q.theme}-${q.numero} »`);
  } else if (!/^(csp|cr)-[1-5]-\d+$/.test(id) || id !== `${id.split("-")[0]}-${q.theme}-${q.numero}`) {
    err(id, "les questions propres aux listes CSP/CR ont un id « csp-thème-numéro » ou « cr-thème-numéro »");
  }
  for (const f of ["question", "reponse"]) if (!q[f] || !String(q[f]).trim()) err(id, `champ « ${f} » vide`);
  for (const f of ["explication", "complement_hors_livret", "livret_pages"]) if (typeof q[f] !== "string") err(id, `champ « ${f} » doit être un texte (éventuellement vide)`);
  if (typeof q.reponse_hors_livret !== "boolean") err(id, "« reponse_hors_livret » doit valoir true ou false");
  if (q.livret_pages && !/^[\d ,–-]+$/.test(q.livret_pages)) err(id, `pages du livret invalides : « ${q.livret_pages} »`);
  if (nat && !q.livret_pages && !q.reponse_hors_livret) warnings.push(`[${id}] aucune page du livret et réponse non marquée « hors livret »`);
  const allText = [q.question, q.reponse, q.explication, q.complement_hors_livret].join(" ");
  if (/\{c\}|<[a-z]/i.test(allText)) err(id, "le texte contient une balise ou un marqueur interdit ({c}, <…>)");
  const m = q.qcm || {};
  if (!m.bonne || !String(m.bonne).trim()) err(id, "QCM : bonne réponse vide");
  if (!Array.isArray(m.mauvaises) || m.mauvaises.length !== 3) err(id, "QCM : il faut exactement 3 mauvaises réponses");
  else {
    const norm = (s) => String(s).trim().toLowerCase();
    const all = [m.bonne, ...m.mauvaises].map(norm);
    if (new Set(all).size !== 4) err(id, "QCM : les 4 propositions doivent être différentes");
    if (m.mauvaises.some((x) => !String(x).trim())) err(id, "QCM : une mauvaise réponse est vide");
  }
}
// Listes CSP et CR : chaque entrée renvoie à une question existante, numérotation continue par thème
for (const [code, L] of Object.entries(listes)) {
  if (!L.nom || !L.slug || !Array.isArray(L.questions)) { err(`liste ${code}`, "nom, slug ou questions manquants"); continue; }
  const n = {};
  for (const e of L.questions) {
    n[e.theme] = (n[e.theme] || 0) + 1;
    if (e.numero !== n[e.theme]) err(`liste ${code} ${e.theme}-${e.numero}`, `numéro attendu ${n[e.theme]}`);
    if (!ids.has(e.id)) err(`liste ${code} ${e.theme}-${e.numero}`, `question inconnue : ${e.id}`);
    if (e.texte !== undefined && !String(e.texte).trim()) err(`liste ${code} ${e.theme}-${e.numero}`, "formulation vide");
  }
}
const slugs = questionSlugs(structuredClone(data.questions || []));
if (new Set(slugs.values()).size !== slugs.size) err("slugs", "deux questions produisent la même adresse");

if (/À COMPLÉTER/.test(JSON.stringify(config.editeur))) warnings.push("site.config.json : renseignez « editeur » (nom et contact) avant la mise en ligne publique — mentions légales obligatoires.");

for (const w of warnings) console.warn("Avertissement " + w);
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) dans les données :`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log(`Données valides : ${data.themes.length} thèmes, ${data.questions.length} questions, listes : ${Object.entries(listes).map(([k, L]) => `${k} ${L.questions.length}`).join(", ")}.`);
