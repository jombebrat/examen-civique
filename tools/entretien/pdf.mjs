// PDF des questions d'entraînement pour l'entretien de naturalisation (assets/coq-civique-questions-entretien-naturalisation.pdf).
// Usage : node scripts/build.mjs && node tools/entretien/pdf.mjs && node scripts/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const { jsPDF } = require(join(ROOT, "assets/vendor/jspdf.umd.min.js"));
const E = JSON.parse(readFileSync(join(ROOT, "dist/data/entretien.json"), "utf8"));
const host = E.site.replace(/^https?:\/\//, "").replace(/\/$/, "");

const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
doc.setProperties({ title: `Questions de l’entretien de naturalisation : ${E.n} questions pour s’entraîner`, subject: "Questions d’entraînement pour l’entretien d’assimilation, avec réponses et conseils (non officielles)", author: "Coq Civique", keywords: "entretien naturalisation, questions, PDF gratuit, entretien d’assimilation", creator: host });
doc.setCreationDate(new Date(E.maj + "T12:00:00Z"));
doc.setFileId("C0C1E7E7000000000000000000000001");
doc.setLineHeightFactor(1.22);
const W = 210, H = 297, M = 18, CW = W - 2 * M, TOP = 18, BOTTOM = 20;
const BLUE = [31, 78, 156], INK = [24, 29, 40], MUTED = [92, 100, 117], LINE = [205, 212, 226], SOFT = [238, 242, 250], GOOD = [21, 115, 60];
const col = (c) => doc.setTextColor(c[0], c[1], c[2]);
const font = (st, sz) => { doc.setFont("helvetica", st); doc.setFontSize(sz); };
const lh = (sz) => sz * 0.3528 * 1.22;
const split = (t, st, sz, w) => { font(st, sz); return doc.splitTextToSize(t, w); };
const text = (t, x, y, st, sz, c, opt) => { font(st, sz); col(c || INK); doc.text(t, x, y, opt || { baseline: "top" }); };
let y = TOP;
const newPage = () => { doc.addPage(); y = TOP; };

// En-tête
doc.setFillColor(0, 85, 164); doc.rect(M, 12, 9, 1.6, "F");
doc.setFillColor(226, 230, 238); doc.rect(M + 9, 12, 9, 1.6, "F");
doc.setFillColor(225, 0, 15); doc.rect(M + 18, 12, 9, 1.6, "F");
text("COQ CIVIQUE", M, 17, "bold", 9, BLUE);
font("normal", 9); col(MUTED); doc.text("Gratuit, sans inscription : " + host, W - M, 17, { align: "right", baseline: "top" });
y = 25;
const title = split(`Entretien de naturalisation : ${E.n} questions pour s’entraîner`, "bold", 19, CW);
text(title, M, y, "bold", 19, INK); y += title.length * lh(19) + 2;
text("Avec les réponses à connaître et des conseils pour les questions personnelles", M, y, "bold", 11.5, BLUE); y += 8;
const intro = [
  "Il n’existe pas de liste officielle des questions de l’entretien d’assimilation. Ces questions d’entraînement sont rédigées par Coq Civique à partir du Livret du citoyen et de ce que le Code civil demande de vérifier (article 21-24).",
  "Comment s’entraîner : lisez la question à voix haute, répondez sans regarder, puis lisez la réponse. Pour les questions personnelles, ne récitez pas : préparez des idées et des exemples vrais, cohérents avec votre dossier.",
  "L’entretien se déroule en français. À la fin, vous signez la Charte des droits et devoirs du citoyen français (annexe du Livret du citoyen) : lisez-la avant.",
].map((t) => split(t, "normal", 9.5, CW - 12));
const boxH = 6 + intro.reduce((s, l) => s + l.length * lh(9.5) + 1.4, 0);
doc.setFillColor(...SOFT); doc.roundedRect(M, y, CW, boxH, 2, 2, "F");
let ry = y + 3.2;
for (const l of intro) { doc.setFillColor(...BLUE); doc.circle(M + 4.5, ry + 1.6, 0.7, "F"); text(l, M + 8, ry, "normal", 9.5, INK); ry += l.length * lh(9.5) + 1.4; }
y += boxH + 7;

let k = 0;
for (const s of E.sections) {
  const head = split(s.titre, "bold", 13.5, CW), chapo = s.chapo ? split(s.chapo, "italic", 9.5, CW) : [];
  const hh = head.length * lh(13.5) + 2 + chapo.length * lh(9.5) + 4;
  if (y + hh + 22 > H - BOTTOM) newPage();
  text(head, M, y, "bold", 13.5, BLUE); y += head.length * lh(13.5) + 2;
  if (chapo.length) { text(chapo, M, y, "italic", 9.5, MUTED); y += chapo.length * lh(9.5) + 4; }
  for (const it of s.items) {
    k++;
    const X = M + 9, QW = CW - 9;
    const ql = split(it.q, "bold", 10.5, QW);
    const al = it.a ? split("Réponse : " + it.a, "normal", 9.5, QW) : [];
    const cl = it.c ? split("Conseil : " + it.c, "italic", 9.5, QW) : [];
    const h = ql.length * lh(10.5) + 1.2 + (al.length ? al.length * lh(9.5) + 1 : 0) + (cl.length ? cl.length * lh(9.5) + 1 : 0) + 4;
    if (y + h > H - BOTTOM) newPage();
    text(k + ".", M, y, "bold", 10.5, BLUE);
    text(ql, X, y, "bold", 10.5, INK); y += ql.length * lh(10.5) + 1.2;
    if (al.length) {
      text(al, X, y, "normal", 9.5, GOOD);
      if (it.u) doc.link(X, y, QW, al.length * lh(9.5), { url: it.u });
      y += al.length * lh(9.5) + 1;
    }
    if (cl.length) { text(cl, X, y, "italic", 9.5, MUTED); y += cl.length * lh(9.5) + 1; }
    y += 4;
  }
  y += 2;
}
// Encadré final
const end = split(`Révisez les questions de connaissance gratuitement sur ${host} : leçons de 5 minutes, quiz, examens blancs et sujets PDF de 40 questions. Version en ligne de ces questions : ${E.page.replace(/^https?:\/\//, "")}`, "normal", 10, CW - 10);
const endH = 9 + end.length * lh(10);
if (y + endH > H - BOTTOM) newPage();
doc.setFillColor(...SOFT); doc.roundedRect(M, y, CW, endH, 2, 2, "F");
text("Continuer à apprendre", M + 5, y + 3, "bold", 10.5, BLUE);
text(end, M + 5, y + 8, "normal", 10, INK);
doc.link(M, y, CW, endH, { url: E.site + "reviser/" });
const pages = doc.getNumberOfPages();
for (let p = 1; p <= pages; p++) {
  doc.setPage(p);
  doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(M, H - 13, W - M, H - 13);
  font("normal", 7.5); col(MUTED);
  doc.text("Coq Civique, site indépendant et non officiel · questions d’entraînement, non officielles · mise à jour : " + E.maj.split("-").reverse().join("/"), M, H - 10, { baseline: "top" });
  doc.text(p + " / " + pages, W - M, H - 10, { align: "right", baseline: "top" });
}
const out = join(ROOT, "assets/coq-civique-questions-entretien-naturalisation.pdf");
writeFileSync(out, Buffer.from(doc.output("arraybuffer")));
console.log(out, pages, "pages,", E.n, "questions");
