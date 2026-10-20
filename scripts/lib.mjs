// Fonctions partagées par build.mjs et validate.mjs (aucune dépendance externe).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadJSON(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Texte brut -> HTML avec la typographie française (espaces insécables, exposants, apostrophes). */
export function typo(raw) {
  let s = esc(raw);
  s = s.replace(/'/g, "’").replace(/\.\.\./g, "…");
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  s = s.replace(/\s+([?!:;»])/g, " $1");
  s = s.replace(/«\s+/g, "« ");
  s = s.replace(/(?<=[^\s ])([?!])/g, " $1");
  s = s.replace(/(\d) (\d{3})\b/g, "$1 $2");
  s = s.replace(/(\d) (€|%|m\b|ans\b|heures\b|jours\b|km\b|mois\b|millions\b|questions\b|minutes\b)/g, "$1 $2");
  s = s.replace(/\bp\. (\d)/g, "p. $1");
  s = s.replace(/\b(\d+)(er|re|ème|e)(?![\p{L}\d])/gu, "$1<sup>$2</sup>");
  s = s.replace(/\b([IVX]+)(re|er|e)(?![\p{L}\d])/gu, "$1<sup>$2</sup>");
  return s;
}

/** Version texte (sans balises) pour les balises <title> et meta description. */
export function plain(raw) {
  return String(raw).replace(/\*\*(.+?)\*\*/g, "$1").replace(/'/g, "’").replace(/\.\.\./g, "…")
    .replace(/\s+([?!:;»])/g, " $1").replace(/«\s+/g, "« ");
}

export function slugify(s, max = 80) {
  let out = String(s).replace(/œ/g, "oe").replace(/Œ/g, "Oe").replace(/æ/g, "ae")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (out.length > max) out = out.slice(0, max).replace(/-[^-]*$/, "");
  return out;
}

/** Détail affiché sous la réponse : explication du livret + complément éventuel. */
export function detailHtml(q) {
  let h = q.explication ? typo(q.explication) : "";
  if (q.complement_hors_livret) h += (h ? " " : "") + '<span class="tag">hors livret</span> ' + typo(q.complement_hors_livret);
  return h;
}

/** Slugs uniques pour chaque question (les doublons de la liste officielle reçoivent -2). */
export function questionSlugs(questions) {
  const seen = new Map(), out = new Map(), firstOf = new Map();
  for (const q of questions) {
    const base = slugify(q.question);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    out.set(q.id, n === 1 ? base : `${base}-${n}`);
    if (n === 1) firstOf.set(base, q.id);
    q._canonicalId = firstOf.get(base);
  }
  return out;
}
