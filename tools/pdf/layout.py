# -*- coding: utf-8 -*-
"""Mise en page de la brochure A4 « Coq Civique » à partir de data/questions.json (HTML -> PDF via Chromium)."""
import html, re, sys, os, io, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FONTDIR = os.path.join(ROOT, "assets", "fonts")
_DATA = json.load(open(os.path.join(ROOT, "data", "questions.json"), encoding="utf-8"))
_CONFIG = json.load(open(os.path.join(ROOT, "site.config.json"), encoding="utf-8"))
BRAND = _CONFIG["nom"]
DOMAIN = _CONFIG["url"].replace("https://", "").replace("http://", "").rstrip("/")

def _detail(q):
    d = q["explication"]
    if q["complement_hors_livret"]:
        d = (d + " {c} " + q["complement_hors_livret"]).strip()
    return d

# Liste à mettre en page : COQ_LISTE=nat (naturalisation, par défaut), cr (carte de résident) ou csp
LISTE = os.environ.get("COQ_LISTE", "nat")
_LISTES = json.load(open(os.path.join(ROOT, "data", "listes.json"), encoding="utf-8"))
_BY_ID = {q["id"]: q for q in _DATA["questions"]}
_row = lambda q, texte=None: (texte or q["question"], q["reponse"], _detail(q), q["livret_pages"], q["reponse_hors_livret"])
if LISTE == "nat":
    THEMES = [(t["titre"], [_row(q) for q in _DATA["questions"] if re.fullmatch(r"[1-5]-\d+", q["id"]) and q["theme"] == t["id"]])
              for t in _DATA["themes"]]
    LIST_NAME = "Naturalisation"
    LIST_SOURCE = "Liste des questions publiée par le ministère de l'Intérieur le 12 décembre 2025."
    LIST_ENDNOTE = "liste officielle des questions de connaissance (naturalisation), 12 décembre 2025"
    BASIS = "Réponses rédigées d'après le Livret du citoyen (édition mai 2026) et la Charte des droits et devoirs du citoyen français. "
else:
    _L = _LISTES[LISTE]
    THEMES = [(t["titre"], [_row(_BY_ID[e["id"]], e.get("texte")) for e in _L["questions"] if e["theme"] == t["id"]])
              for t in _DATA["themes"]]
    LIST_NAME = _L["nom"]
    LIST_SOURCE = f"Liste officielle des questions de connaissance « {_L['nom'].lower()} », ministère de l'Intérieur (formation-civique.interieur.gouv.fr)."
    LIST_ENDNOTE = f"liste officielle des questions de connaissance « {_L['nom'].lower()} », formation-civique.interieur.gouv.fr"
    BASIS = "Réponses rédigées par Coq Civique, notamment d'après le Livret du citoyen (édition mai 2026) et les textes officiels. "

THEME_COLORS = ["#1F4E9C", "#2B6B5E", "#A8432F", "#8A6516", "#5B3F8E"]
THEME_TINTS  = ["#EEF2FA", "#EBF3F1", "#F8EEEB", "#F6F1E6", "#F1EEF7"]

ESSENTIEL = [[re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html.escape(x, quote=False)) for x in t["essentiel"]] for t in _DATA["themes"]]


def typo(s):
    """Typographie française appliquée à un texte déjà échappé."""
    s = s.replace("'", "\u2019")
    s = s.replace("...", "\u2026")
    # espaces insécables
    s = re.sub(r"\s+([?!:;»])", "\u00a0\\1", s)
    s = re.sub(r"«\s+", "«\u00a0", s)
    s = re.sub(r"(?<=[^\s\u00a0])([?!])", "\u00a0\\1", s)
    s = re.sub(r"(\d) (\d{3})\b", "\\1\u202f\\2", s)
    s = re.sub(r"(\d) (€|%|m\b|ans\b|heures\b|jours\b|km\b|mois\b|millions\b|questions\b|minutes\b)", "\\1\u00a0\\2", s)
    s = re.sub(r"\bp\. (\d)", "p.\u00a0\\1", s)
    # exposants : 1er, 28e, 101ème, XVIIe, Ve, IIIe
    s = re.sub(r"\b(\d+)(er|re|ème|e)\b", r"\1<sup>\2</sup>", s)
    s = re.sub(r"\b([IVX]+)(re|er|e)\b", r"\1<sup>\2</sup>", s)
    return s


def T(s):
    return typo(html.escape(s, quote=False))


def detail_html(d):
    if not d:
        return ""
    parts = d.split("{c}")
    out = T(parts[0].strip())
    for p in parts[1:]:
        out += ' <span class="tag">hors livret</span> ' + T(p.strip())
    return out.strip()


def font_faces():
    faces = [("Fraunces", 400, "normal", "fraunces-400"), ("Fraunces", 400, "italic", "fraunces-400-italic"),
             ("Fraunces", 600, "normal", "fraunces-600"), ("Fraunces", 700, "normal", "fraunces-700"),
             ("Fraunces", 800, "normal", "fraunces-800"),
             ("Atkinson", 400, "normal", "atkinson-400"), ("Atkinson", 400, "italic", "atkinson-400-italic"),
             ("Atkinson", 700, "normal", "atkinson-700")]
    return "\n".join(f"@font-face{{font-family:'{f}';font-weight:{w};font-style:{st};src:url('file://{os.path.join(FONTDIR, n)}.woff2') format('woff2');}}" for f, w, st, n in faces)


CSS = r"""
:root{
  --ink:#15203B; --muted:#5A6377; --soft:#8A93A6; --line:#D7DCE6; --hair:#E6E9F0;
  --navy:#1A2A52; --blue:#1F4E9C; --red:#C8102E; --paper:#FFFFFF; --ans:#F6F8FB;
}
@page{ size:A4; margin:14mm 15mm 16mm 15mm; }
*{ box-sizing:border-box; }
html,body{ margin:0; padding:0; background:#fff; color:var(--ink);
  font-family:'Atkinson', sans-serif; font-size:9.6pt; line-height:1.38;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
sup{ font-size:0.68em; line-height:0; vertical-align:0.42em; }
b,strong{ font-weight:700; }
h1,h2,h3{ font-family:'Fraunces', Georgia, serif; font-weight:700; margin:0; color:var(--navy); }
.page-break{ break-before:page; }

/* ---------- Sommaire / mode d'emploi ---------- */
.intro h2{ font-size:22pt; letter-spacing:-0.01em; margin-bottom:2mm; }
.intro .lead{ color:var(--muted); font-size:10.2pt; max-width:150mm; margin:0 0 7mm; }
.toc{ border-top:1.4pt solid var(--navy); margin-bottom:9mm; }
.toc-row{ display:grid; grid-template-columns:16mm 1fr 26mm 14mm; align-items:baseline;
  padding:3.1mm 0; border-bottom:0.6pt solid var(--line); }
.toc-num{ font-family:'Fraunces',serif; font-weight:800; font-size:17pt; line-height:1; }
.toc-title{ font-family:'Fraunces',serif; font-weight:700; font-size:12.5pt; color:var(--navy); }
.toc-count{ color:var(--muted); font-size:9pt; text-align:right; }
.toc-page{ font-family:'Fraunces',serif; font-weight:700; font-size:12.5pt; text-align:right; color:var(--navy); }
.howto{ display:grid; grid-template-columns:1fr 1fr; gap:5mm; }
.howto .card{ border:0.7pt solid var(--line); border-radius:2.2mm; padding:4mm 4.5mm; break-inside:avoid; }
.howto .card h3{ font-size:11pt; margin-bottom:1.6mm; }
.howto .card p{ margin:0; color:var(--muted); font-size:9pt; }
.howto .demo{ display:inline-block; vertical-align:-1pt; }
.legend-tag{ display:inline-block; }
.examfmt{ margin-top:8mm; background:var(--navy); color:#fff; border-radius:2.5mm; padding:5mm 6mm;
  display:grid; grid-template-columns:repeat(4,1fr); gap:4mm; }
.examfmt .k{ font-family:'Fraunces',serif; font-weight:800; font-size:20pt; line-height:1.05; }
.examfmt .l{ font-size:8.4pt; opacity:.85; margin-top:1mm; }
.sources{ margin-top:6mm; font-size:8.2pt; color:var(--muted); }

/* ---------- Ouverture de thème ---------- */
.opener{ break-before:page; margin-bottom:5mm; }
.opener .band{ display:flex; align-items:flex-end; gap:5mm; padding-bottom:3.2mm;
  border-bottom:1.6pt solid var(--c); }
.opener .num{ font-family:'Fraunces',serif; font-weight:800; font-size:44pt; line-height:.82; color:var(--c); }
.opener .ttl{ flex:1; }
.opener .kicker{ font-size:8pt; letter-spacing:.14em; text-transform:uppercase; color:var(--c); font-weight:700; margin-bottom:1mm; }
.opener h2{ font-size:20pt; line-height:1.1; }
.opener .count{ font-size:8.6pt; color:var(--muted); white-space:nowrap; padding-bottom:1mm; }
.essentiel{ margin-top:4.2mm; background:var(--t); border-radius:2mm; padding:3.6mm 5mm 3.8mm; break-inside:avoid; }
.essentiel .eh{ font-family:'Fraunces',serif; font-weight:700; font-size:10.5pt; color:var(--c); margin-bottom:1.2mm; }
.essentiel ul{ margin:0; padding:0; list-style:none; }
.essentiel li{ position:relative; padding-left:4mm; margin:0.9mm 0; font-size:8.9pt; line-height:1.36; }
.essentiel li::before{ content:""; position:absolute; left:0.4mm; top:1.55mm; width:1.5mm; height:1.5mm; border-radius:50%; background:var(--c); }

/* ---------- Tableau questions / réponses ---------- */
table.qa{ width:100%; border-collapse:collapse; table-layout:fixed; }
table.qa col.c-n{ width:11mm; } table.qa col.c-q{ width:42%; }
table.qa thead th{ text-align:left; font-weight:700; }
table.qa thead tr.th-theme th{ font-size:7.4pt; letter-spacing:.13em; text-transform:uppercase; color:var(--c);
  padding:0 0 1.6mm 0; }
table.qa thead tr.th-cols th{ font-size:7.6pt; letter-spacing:.08em; text-transform:uppercase; color:var(--soft);
  padding:1.6mm 2.4mm 1.6mm 0; border-bottom:1pt solid var(--c); }
table.qa thead tr.th-cols th.h-a{ padding-left:3.2mm; background:var(--ans); }
table.qa tbody tr{ break-inside:avoid; page-break-inside:avoid; }
table.qa tbody td{ vertical-align:top; padding:1.95mm 2.4mm 2.05mm 0; border-bottom:0.55pt solid var(--hair); }
td.n{ padding-right:1mm !important; }
td.n .no{ font-family:'Fraunces',serif; font-weight:700; font-size:11pt; color:var(--c); line-height:1.1; }
td.n .box{ display:block; width:3.1mm; height:3.1mm; border:0.7pt solid #9AA3B5; border-radius:0.6mm; margin-top:1.5mm; }
td.q{ font-weight:400; color:var(--ink); padding-right:4mm !important; }
td.a{ background:var(--ans); padding-left:3.2mm !important; padding-right:3mm !important; border-left:1.3pt solid var(--c); }
td.a .ans{ font-weight:700; color:var(--navy); }
td.a .det{ margin-top:0.6mm; font-size:8.3pt; line-height:1.34; color:var(--muted); }
td.a .ref{ display:inline-block; margin-top:0.4mm; font-size:7.3pt; color:var(--soft); letter-spacing:.02em; white-space:nowrap; }
.tag{ display:inline-block; font-size:6.6pt; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
  color:var(--red); border:0.6pt solid var(--red); border-radius:1mm; padding:0.05mm 1.1mm 0; line-height:1.45; vertical-align:0.5pt; white-space:nowrap; }

/* ---------- Mémo ---------- */
.memo-head{ break-before:page; display:flex; align-items:flex-end; justify-content:space-between;
  border-bottom:1.6pt solid var(--navy); padding-bottom:3mm; margin-bottom:5mm; }
.memo-head h2{ font-size:22pt; }
.memo-head .sub{ font-size:8.6pt; color:var(--muted); }
.kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:2.6mm; margin-bottom:6mm; }
.kpi{ border:0.7pt solid var(--line); border-radius:2mm; padding:2.6mm 3mm 2.8mm; break-inside:avoid; }
.kpi .v{ font-family:'Fraunces',serif; font-weight:800; font-size:16.5pt; line-height:1.05; color:var(--navy); }
.kpi .t{ font-size:7.9pt; color:var(--muted); margin-top:0.8mm; line-height:1.3; }
.memo-cols{ display:grid; grid-template-columns:1fr 1fr; gap:6mm; }
.memo-sec h3{ font-size:12pt; margin:0 0 2mm; padding-bottom:1.2mm; border-bottom:0.8pt solid var(--line); }
.tl{ margin:0; padding:0; list-style:none; columns:2; column-gap:8mm; }
.tl li{ display:grid; grid-template-columns:23mm 1fr; gap:2mm; padding:1.05mm 0; border-bottom:0.5pt dotted var(--line); font-size:8.7pt; break-inside:avoid; }
.tl li .y{ font-family:'Fraunces',serif; font-weight:700; color:var(--blue); font-size:9.6pt; }
.tbl{ width:100%; border-collapse:collapse; font-size:8.7pt; }
.tbl td{ padding:1.15mm 1.5mm 1.15mm 0; border-bottom:0.5pt dotted var(--line); vertical-align:top; }
.tbl td.k{ font-family:'Fraunces',serif; font-weight:700; color:var(--blue); white-space:nowrap; width:23mm; }
.memo-sec{ break-inside:avoid; margin-bottom:5.5mm; }
.memo-p2{ padding-top:1mm; }
.method{ margin-top:2mm; border:0.8pt solid var(--line); border-radius:2.2mm; padding:4mm 5mm; break-inside:avoid; }
.method h3{ font-size:12pt; margin-bottom:2.4mm; }
.method ol{ margin:0; padding-left:5mm; }
.method li{ margin:1.4mm 0; font-size:9pt; }
.pieges li{ margin:1.1mm 0; font-size:8.7pt; }
.pieges{ padding-left:4mm; margin:0; }
.notes{ margin-top:5mm; break-inside:avoid; }
.notes .nh{ font-family:'Fraunces',serif; font-weight:700; font-size:10.5pt; color:var(--c); padding-bottom:1.5mm; border-bottom:1pt solid var(--c); }
.notes .ln{ height:8mm; border-bottom:0.5pt solid #D3D8E2; }
.endnote{ margin-top:4mm; font-size:7.8pt; color:var(--soft); }
"""

COVER_CSS = r"""
@page{ size:A4; margin:0; }
html,body{ margin:0; padding:0; }
.cover{ position:relative; width:210mm; height:297mm; overflow:hidden; background:#fff; color:var(--ink); }
.cover .flag{ position:absolute; top:0; left:0; right:0; height:5mm; display:flex; }
.cover .flag span{ flex:1; }
.cover .logo{ position:absolute; top:17mm; right:18mm; width:30mm; height:30mm; }
.cover .inner{ position:absolute; top:24mm; left:20mm; right:20mm; bottom:20mm; display:flex; flex-direction:column; }
.cover .eyebrow{ font-size:8.6pt; letter-spacing:.2em; text-transform:uppercase; color:var(--red); font-weight:700; }
.cover h1{ font-size:62pt; line-height:.98; letter-spacing:-0.02em; margin-top:5mm; color:var(--navy); }
.cover h1 em{ font-style:italic; font-weight:400; color:var(--blue); }
.cover .subtitle{ font-family:'Fraunces',serif; font-size:17pt; line-height:1.3; color:var(--navy); margin-top:7mm; max-width:150mm; font-weight:400; }
.cover .rule{ width:28mm; height:1.6pt; background:var(--red); margin:9mm 0 7mm; }
.cover .basis{ font-size:10pt; color:var(--muted); max-width:140mm; line-height:1.5; }
.cover .themes{ margin-top:auto; border-top:1.2pt solid var(--navy); }
.cover .trow{ display:grid; grid-template-columns:14mm 1fr 30mm; align-items:baseline; padding:3.2mm 0; border-bottom:0.6pt solid var(--line); }
.cover .trow .n{ font-family:'Fraunces',serif; font-weight:800; font-size:15pt; }
.cover .trow .t{ font-family:'Fraunces',serif; font-weight:700; font-size:12pt; color:var(--navy); }
.cover .trow .c{ font-size:9pt; color:var(--muted); text-align:right; }
.cover .total{ display:flex; justify-content:space-between; align-items:baseline; margin-top:4mm; }
.cover .total .big{ font-family:'Fraunces',serif; font-weight:800; font-size:30pt; color:var(--navy); line-height:1; }
.cover .total .big small{ font-size:11pt; font-weight:700; color:var(--muted); margin-left:2mm; }
.cover .cover-exam{ margin-top:13mm; }
.cover .foot{ font-size:7.8pt; color:var(--soft); text-align:right; line-height:1.45; }
"""


def notes_html(h_mm):
    if not h_mm:
        return ""
    n = int((h_mm - 9) // 8)
    if n < 3:
        return ""
    return '<div class="notes"><div class="nh">Mes notes</div>' + '<div class="ln"></div>' * n + '</div>'


def logo_data_uri():
    import base64
    with open(os.path.join(ROOT, "assets", "logo.png"), "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")


def build_cover():
    rows = ""
    for i, (name, qs) in enumerate(THEMES):
        rows += (f'<div class="trow"><span class="n" style="color:{THEME_COLORS[i]}">0{i+1}</span>'
                 f'<span class="t">{T(name)}</span><span class="c">{len(qs)}\u00a0questions</span></div>')
    total = sum(len(q) for _, q in THEMES)
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Couverture</title>
<style>{font_faces()}{CSS}{COVER_CSS}</style></head><body>
<div class="cover">
  <div class="flag"><span style="background:#1F4E9C"></span><span style="background:#E9ECF2"></span><span style="background:#C8102E"></span></div>
  <img class="logo" src="{logo_data_uri()}" alt="">
  <div class="inner">
    <div class="eyebrow">{BRAND} · Fiches de révision · {LIST_NAME}</div>
    <h1>Examen<br>civique <em>2026</em></h1>
    <div class="subtitle">Les {total} questions officielles de connaissance, avec leurs réponses expliquées.</div>
    <div class="rule"></div>
    <div class="basis">{T(BASIS + LIST_SOURCE)}</div>
    <div class="examfmt cover-exam">
      <div><div class="k">40</div><div class="l">questions à choix multiples</div></div>
      <div><div class="k">45&nbsp;min</div><div class="l">durée maximale</div></div>
      <div><div class="k">32/40</div><div class="l">{T("bonnes réponses minimum (80 %)")}</div></div>
      <div><div class="k">1/4</div><div class="l">{T("une seule bonne réponse sur quatre propositions")}</div></div>
    </div>
    <div class="themes">{rows}</div>
    <div class="total"><div class="big">{total}<small>questions · 5 thèmes</small></div>
      <div class="foot">Document de révision non officiel.<br>{DOMAIN}</div></div>
  </div>
</div></body></html>"""


def build_main(toc_pages=None, notes=None):
    toc_pages = toc_pages or {}
    notes = notes or {}
    total = sum(len(q) for _, q in THEMES)
    # --- Sommaire + mode d'emploi
    toc = ""
    for i, (name, qs) in enumerate(THEMES):
        pg = toc_pages.get(f"t{i+1}", "00")
        toc += (f'<div class="toc-row"><span class="toc-num" style="color:{THEME_COLORS[i]}">0{i+1}</span>'
                f'<span class="toc-title">{T(name)}</span><span class="toc-count">{len(qs)}\u00a0questions</span>'
                f'<span class="toc-page">{pg}</span></div>')
    pg = toc_pages.get("memo", "00")
    toc += (f'<div class="toc-row"><span class="toc-num" style="color:#C8102E">+</span>'
            f'<span class="toc-title">Fiche mémo : chiffres, dates et pièges</span><span class="toc-count">à relire la veille</span>'
            f'<span class="toc-page">{pg}</span></div>')

    intro = f"""
<section class="intro">
  <h2>Sommaire</h2>
  <p class="lead">{T("Les questions sont reprises dans l'ordre de la liste officielle, thème par thème. Chaque thème commence par l'essentiel à retenir.")}</p>
  <div class="toc">{toc}</div>
  <h2 style="font-size:15pt;margin-bottom:4mm">Comment utiliser ce livret</h2>
  <div class="howto">
    <div class="card"><h3>1. Cachez la colonne « Réponse »</h3><p>{T("Posez une feuille sur la colonne de droite (fond grisé), lisez la question et répondez à voix haute avant de vérifier.")}</p></div>
    <div class="card"><h3>2. Cochez ce que vous savez</h3><p>{T("Cochez la petite case sous le numéro quand la réponse est acquise. Au tour suivant, ne révisez que les questions non cochées.")}</p></div>
    <div class="card"><h3>3. Allez plus loin dans le livret</h3><p>{T("La mention « Livret p. 16 » renvoie à la page du Livret du citoyen (mai 2026) où le sujet est expliqué.")}</p></div>
    <div class="card"><h3>4. Repérez les compléments <span class="tag">hors livret</span></h3><p>{T("Ce repère signale une information qui ne figure pas dans le livret, ajoutée pour répondre complètement à la question.")}</p></div>
    <div class="card"><h3>5. Plusieurs réponses listées ?</h3><p>{T("Pour les questions du type « Quel peintre est français ? », toutes les bonnes réponses possibles sont données. À l'examen, une seule d'entre elles figurera parmi les 4 propositions.")}</p></div>
    <div class="card"><h3>6. Utilisez « Mes notes »</h3><p>{T("À la fin de chaque thème, des lignes sont prévues pour noter vos questions difficiles ou vos moyens mnémotechniques.")}</p></div>
  </div>
</section>"""

    # --- Thèmes
    body = ""
    for i, (name, qs) in enumerate(THEMES):
        c, t = THEME_COLORS[i], THEME_TINTS[i]
        ess = "".join(f"<li>{typo(x.replace(chr(39), chr(8217)))}</li>" for x in ESSENTIEL[i])
        rows = ""
        for j, (q, a, d, p, h) in enumerate(qs, 1):
            meta = []
            if p:
                meta.append("Livret p.\u00a0" + p.replace("-", "\u2013"))
            ref = ""
            if meta or h:
                ref = '<span class="ref">' + " · ".join(meta) + "</span>"
                if h:
                    ref = ('<span class="tag">hors livret</span> ' + ref) if meta else '<span class="tag">hors livret</span>'
            det = detail_html(d)
            det_block = f'<div class="det">{det}' + (f' {ref}' if ref else '') + '</div>' if det else (f'<div class="det">{ref}</div>' if ref else '')
            rows += (f'<tr><td class="n"><div class="no">{j}</div><span class="box"></span></td>'
                     f'<td class="q">{T(q)}</td>'
                     f'<td class="a"><div class="ans">{T(a)}</div>{det_block}</td></tr>')
        body += f"""
<section class="theme" style="--c:{c};--t:{t}">
  <div class="opener" data-marker="t{i+1}">
    <div class="band">
      <div class="num">0{i+1}</div>
      <div class="ttl"><div class="kicker">Thème {i+1}</div><h2>{T(name)}</h2></div>
      <div class="count">{len(qs)}\u00a0questions</div>
    </div>
    <div class="essentiel"><div class="eh">L’essentiel à retenir</div><ul>{ess}</ul></div>
  </div>
  <table class="qa">
    <colgroup><col class="c-n"><col class="c-q"><col class="c-a"></colgroup>
    <thead>
      <tr class="th-theme"><th colspan="3">Thème {i+1} · {T(name)}</th></tr>
      <tr class="th-cols"><th>N°</th><th>Question</th><th class="h-a">Réponse</th></tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
  {notes_html(notes.get(i+1))}
</section>"""

    memo = build_memo()
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Examen civique – Fiches de révision</title>
<style>{font_faces()}{CSS}</style></head><body>{intro}{body}{memo}</body></html>"""


def build_memo():
    kpis = [
        ("577", "députés, élus 5 ans au suffrage direct"),
        ("348", "sénateurs, élus 6 ans au suffrage indirect"),
        ("5 ans", "mandat du Président (renouvelable une fois)"),
        ("6 ans", "mandat du maire et du conseil municipal"),
        ("500", "parrainages d'élus pour être candidat à la présidentielle"),
        ("101", "départements (96 en métropole, 5 outre-mer)"),
        ("13 / 18", "régions en métropole / au total"),
        ("27", "États dans l'Union européenne"),
        ("68,6 M", "habitants en France (2025)"),
        ("18 ans", "majorité civile, droit de vote"),
        ("15 ans", "majorité numérique"),
        ("3 – 16 ans", "instruction obligatoire"),
        ("35 h", "durée légale du travail par semaine"),
        ("28 jours", "congé paternité"),
        ("5 jours", "pour déclarer une naissance à la mairie"),
        ("4 810 m", "Mont-Blanc, plus haut sommet"),
    ]
    k = "".join(f'<div class="kpi"><div class="v">{T(v)}</div><div class="t">{T(t)}</div></div>' for v, t in kpis)
    dates = [
        ("1789", "14 juillet : prise de la Bastille ; DDHC"),
        ("1792", "Ire République ; La Marseillaise"),
        ("1793", "Louis XVI guillotiné"),
        ("1804", "Napoléon Ier empereur ; Code civil"),
        ("1848", "Abolition de l'esclavage (Schœlcher) ; suffrage universel masculin"),
        ("1881-1882", "École gratuite, laïque et obligatoire (Jules Ferry)"),
        ("1889", "Tour Eiffel (Exposition universelle)"),
        ("1901", "Loi sur la liberté d'association"),
        ("1905", "Séparation des Églises et de l'État"),
        ("1914-1918", "Première Guerre mondiale (armistice le 11 novembre)"),
        ("1939-1945", "Seconde Guerre mondiale (fin le 8 mai 1945)"),
        ("18 juin 1940", "Appel du général de Gaulle"),
        ("1944", "Droit de vote des femmes ; 6 juin débarquement ; 25 août Paris libéré"),
        ("1945", "Sécurité sociale ; création de l'ONU"),
        ("1951 / 1957", "CECA / traité de Rome (CEE)"),
        ("1958", "Constitution de la Ve République"),
        ("1962", "Président élu au suffrage direct ¹"),
        ("1974 / 1975", "Majorité à 18 ans / loi Veil (IVG)"),
        ("1981", "Abolition de la peine de mort"),
        ("1992", "Traité de Maastricht : UE et citoyenneté européenne"),
        ("2002", "Pièces et billets en euros"),
        ("2011", "Mayotte, 101e département ; Défenseur des droits"),
        ("2013", "Mariage pour tous ; la Croatie entre dans l'UE"),
        ("2020", "Brexit"),
        ("2024", "IVG garantie par la Constitution"),
    ]
    tl = "".join(f'<li><span class="y">{T(y)}</span><span>{T(e)}</span></li>' for y, e in dates)
    jours = [
        ("1er mai", "Fête du Travail"), ("8 mai", "Victoire de 1945"), ("9 mai", "Journée de l'Europe"),
        ("10 mai", "Mémoire de la traite et de l'esclavage"), ("21 juin", "Fête de la musique"),
        ("14 juillet", "Fête nationale"), ("Septembre", "Journées du patrimoine"),
        ("11 novembre", "Armistice de 1918"), ("9 décembre", "Journée de la laïcité"),
    ]
    jt = "".join(f'<tr><td class="k">{T(a)}</td><td>{T(b)}</td></tr>' for a, b in jours)
    urg = [("15", "SAMU"), ("17", "Police secours"), ("18", "Sapeurs-pompiers"), ("112", "Urgences (numéro européen)"),
           ("114", "Urgences par SMS (personnes malentendantes)"), ("115", "Hébergement d'urgence"), ("119", "Enfance maltraitée"),
           ("3919", "Violences conjugales"), ("3018", "Harcèlement scolaire"), ("196", "Secours en mer")]
    ut = "".join(f'<tr><td class="k">{T(a)}</td><td>{T(b)}</td></tr>' for a, b in urg)
    qui = [("Commune", "Écoles maternelles et primaires, état civil, routes communales"),
           ("Département", "Collèges, action sociale, routes départementales"),
           ("Région", "Lycées, transports régionaux, développement économique"),
           ("Préfet", "Représente l'État dans le département et la région"),
           ("Juge", "Sanctionne les infractions (vol, etc.)"),
           ("CPAM", "Rembourse les frais de santé")]
    qt = "".join(f'<tr><td class="k">{T(a)}</td><td>{T(b)}</td></tr>' for a, b in qui)
    pieges = [
        "Le <b>coq</b> est un symbole national, mais <b>pas officiel</b>.",
        "Le <b>maire</b> est élu par le <b>conseil municipal</b> ; les <b>sénateurs</b> au suffrage <b>indirect</b>.",
        "Voter <b>n'est pas obligatoire</b> ; l'<b>inscription</b> sur les listes est nécessaire pour voter.",
        "Neutralité : l'<b>agent public</b> ne montre pas sa religion, l'<b>usager</b> peut porter un signe religieux.",
        "Le <b>blasphème</b> n'est pas un délit ; l'<b>appel à la haine</b> en est un.",
        "<b>Contravention</b> &lt; <b>délit</b> (vol, conduite sans permis) &lt; <b>crime</b> (meurtre, viol).",
        "Seul le <b>mariage civil</b> en mairie est reconnu ; la <b>polygamie</b> est interdite.",
        "<b>Parlement européen</b> : Strasbourg · <b>Commission</b> : Bruxelles · <b>BCE</b> : Francfort.",
    ]
    pl = "".join(f"<li>{typo(x.replace(chr(39), chr(8217)))}</li>" for x in pieges)
    methode = [
        "<b>Répondez à toutes les questions</b> : une erreur ou une absence de réponse vaut 0, il n'y a pas de point retiré.",
        "<b>Gérez votre temps</b> : 45 minutes pour 40 questions, soit un peu plus d'une minute par question.",
        "<b>Lisez les 4 propositions</b> avant de choisir, puis éliminez celles qui sont manifestement fausses.",
        "<b>Méfiez-vous des mots absolus</b> (« toujours », « jamais », « seulement ») et vérifiez les dates et les chiffres.",
        "<b>Visez 32 bonnes réponses sur 40</b> (80 %) : révisez en priorité les questions non cochées de ce livret.",
    ]
    ml = "".join(f"<li>{typo(x.replace(chr(39), chr(8217)))}</li>" for x in methode)
    return f"""
<section class="memo" data-marker="memo">
  <div class="memo-head"><h2>Fiche mémo</h2><div class="sub">{T("Chiffres, dates et pièges à relire la veille de l'examen")}</div></div>
  <div class="kpis">{k}</div>
  <div class="memo-sec"><h3>Dates clés</h3><ul class="tl">{tl}</ul></div>
  <div class="memo-cols">
    <div class="memo-sec"><h3>Jours à retenir</h3><table class="tbl">{jt}</table></div>
    <div class="memo-sec"><h3>Numéros d’urgence (gratuits)</h3><table class="tbl">{ut}</table></div>
  </div>
  <div class="memo-p2">
  <div class="memo-cols">
    <div class="memo-sec"><h3>Qui fait quoi ?</h3><table class="tbl">{qt}</table></div>
    <div class="memo-sec"><h3>Pièges fréquents</h3><ul class="pieges">{pl}</ul></div>
  </div>
  <div class="method"><h3>Le jour de l’examen : la bonne méthode</h3><ol>{ml}</ol></div>
  </div>
  <p class="endnote">{T("¹ Information hors livret. Sources : Livret du citoyen, édition mai 2026 ; Charte des droits et devoirs du citoyen français ; " + LIST_ENDNOTE + ".")}</p>
</section>"""


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else HERE
    toc = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    with open(os.path.join(out, "cover.html"), "w", encoding="utf-8") as f:
        f.write(build_cover())
    with open(os.path.join(out, "main.html"), "w", encoding="utf-8") as f:
        f.write(build_main(toc))
    print("ok")
