// Produit les trois sujets d'exemple (un par liste, sujet n° 2026) dans assets/examens/, avec le même code que le générateur du site.
// Usage : node scripts/build.mjs && node tools/examen40/exemples.mjs && node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const { jsPDF } = require(join(ROOT, "assets/vendor/jspdf.umd.min.js"));
vm.runInThisContext(readFileSync(join(ROOT, "src/site/examen40.js"), "utf8"));
const { build, render } = globalThis.CoqExam40;
const data = JSON.parse(readFileSync(join(ROOT, "dist/data/examen40.json"), "utf8"));
const site = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8")).url;

const NUM = 2026, out = join(ROOT, "assets/examens"), inv = {};
mkdirSync(out, { recursive: true });
for (const code of ["nat", "cr", "csp"]) {
  const ex = build(data, code, NUM);
  // Date et identifiant fixes : le fichier ne change que si le contenu change
  const doc = render(jsPDF, ex, { site, date: new Date("2026-10-21T12:00:00Z"), fileId: "C0C1C1C1E0A0000000000000000" + String(NUM).padStart(5, "0") });
  const fichier = `coq-civique-examen-civique-40-questions-${code}-${NUM}.pdf`;
  writeFileSync(join(out, fichier), Buffer.from(doc.output("arraybuffer")));
  inv[code] = { fichier, sujet: ex.id, pages: doc.getNumberOfPages() };
  console.log(fichier, ex.id, doc.getNumberOfPages(), "pages");
}
writeFileSync(join(out, "examens.json"), JSON.stringify(inv, null, 2) + "\n");
