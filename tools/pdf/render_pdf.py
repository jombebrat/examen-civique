# -*- coding: utf-8 -*-
"""Rendu : HTML -> PDF (Chromium), sommaire en deux passes, pieds de page, fusion."""
import os, sys, json, io, re, subprocess
from playwright.sync_api import sync_playwright
from pypdf import PdfReader, PdfWriter
import pdfplumber
from fontTools.ttLib import TTFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as RLTTFont
from reportlab.lib.units import mm

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
LISTE = os.environ.get("COQ_LISTE", "nat")
FICHIERS = {"nat": "coq-civique-examen-civique.pdf", "cr": "coq-civique-examen-civique-carte-de-resident.pdf",
            "csp": "coq-civique-examen-civique-carte-de-sejour-pluriannuelle.pdf"}
TARGET = os.path.join(HERE, "..", "..", "assets", FICHIERS[LISTE])
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE)
import layout as build
from layout import THEMES


def ttf_from_woff(src, dst):
    if not os.path.exists(dst):
        f = TTFont(src); f.flavor = None; f.save(dst)
    return dst


def html_to_pdf(page, html_path, pdf_path):
    page.goto("file://" + html_path)
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready")
    page.pdf(path=pdf_path, format="A4", print_background=True, prefer_css_page_size=True)


def find_markers(pdf_path):
    """Pages (1-based, dans main.pdf) où commencent les thèmes et le mémo."""
    res = {}
    counts = {f"t{i+1}": len(q) for i, (_, q) in enumerate(THEMES)}
    with pdfplumber.open(pdf_path) as pdf:
        for idx, pg in enumerate(pdf.pages):
            if idx == 0:
                continue  # sommaire
            txt = re.sub(r"\s+", " ", (pg.extract_text() or "")).lower()
            for key, n in counts.items():
                if key not in res and f"thème {key[1:]}" in txt and f"{n} questions" in txt and "essentiel à retenir" in txt:
                    res[key] = idx + 1
            if "memo" not in res and "fiche mémo" in txt and "chiffres, dates" in txt:
                res["memo"] = idx + 1
    return res


def free_space_per_theme(pdf_path, marks_phys):
    """Hauteur libre (mm) sous la dernière question de chaque thème."""
    PT = 72 / 25.4
    starts = [marks_phys[f"t{i}"] - 1 for i in range(1, 6)] + [marks_phys["memo"] - 1]  # index main.pdf 1-based
    res = {}
    with pdfplumber.open(pdf_path) as pdf:
        for i in range(5):
            last = starts[i + 1] - 1  # dernière page du thème (1-based)
            page = pdf.pages[last - 1]
            bottoms = [c["bottom"] for c in page.chars]
            bottoms += [r["bottom"] for r in page.rects if r["height"] < 300]
            lowest = max(bottoms)
            limit = float(page.height) - 16 * PT  # marge basse
            free_mm = (limit - lowest) / PT - 8   # marge de sécurité
            if free_mm > 40:
                res[i + 1] = round(free_mm, 1)
    return res


def footer_overlay(n_pages, font_regular, font_semibold, out_path):
    pdfmetrics.registerFont(RLTTFont("InterR", font_regular))
    pdfmetrics.registerFont(RLTTFont("InterS", font_semibold))
    W, H = 210 * mm, 297 * mm
    c = canvas.Canvas(out_path, pagesize=(W, H), initialFontName="InterR", initialFontSize=7.3)
    for p in range(1, n_pages + 1):
        if p > 1:
            y = 8.2 * mm
            c.setStrokeColorRGB(0.85, 0.87, 0.91); c.setLineWidth(0.5)
            c.line(15 * mm, y + 4.2 * mm, W - 15 * mm, y + 4.2 * mm)
            c.setFillColorRGB(0.45, 0.49, 0.58)
            c.setFont("InterR", 7.3)
            c.drawString(15 * mm, y, f"{build.BRAND} · Examen civique — {build.DOMAIN}")
            c.setFont("InterS", 7.6)
            c.setFillColorRGB(0.10, 0.16, 0.32)
            c.drawRightString(W - 15 * mm, y, f"{p} / {n_pages}")
        c.showPage()
    c.save()


def main():
    fr = ttf_from_woff(os.path.join(build.FONTDIR, "atkinson-400.woff2"), os.path.join(OUT, "Atkinson-Regular.ttf"))
    fs = ttf_from_woff(os.path.join(build.FONTDIR, "atkinson-700.woff2"), os.path.join(OUT, "Atkinson-Bold.ttf"))

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        # passe 1
        open(os.path.join(OUT, "cover.html"), "w", encoding="utf-8").write(build.build_cover())
        open(os.path.join(OUT, "main.html"), "w", encoding="utf-8").write(build.build_main({}))
        html_to_pdf(pg, os.path.join(OUT, "cover.html"), os.path.join(OUT, "cover.pdf"))
        html_to_pdf(pg, os.path.join(OUT, "main.html"), os.path.join(OUT, "main.pdf"))
        marks = find_markers(os.path.join(OUT, "main.pdf"))
        # numéros physiques : couverture = page 1
        toc = {k: v + 1 for k, v in marks.items()}
        print("marqueurs", toc)
        # passe 2
        open(os.path.join(OUT, "main.html"), "w", encoding="utf-8").write(build.build_main(toc))
        html_to_pdf(pg, os.path.join(OUT, "main.html"), os.path.join(OUT, "main.pdf"))
        marks2 = {k: v + 1 for k, v in find_markers(os.path.join(OUT, "main.pdf")).items()}
        assert marks2 == toc, (marks2, toc)
        # passe 3 : zones « Mes notes » dans l'espace libre en fin de thème
        notes = free_space_per_theme(os.path.join(OUT, "main.pdf"), marks2)
        print("notes (mm)", notes)
        n_before = len(PdfReader(os.path.join(OUT, "main.pdf")).pages)
        open(os.path.join(OUT, "main.html"), "w", encoding="utf-8").write(build.build_main(toc, notes))
        html_to_pdf(pg, os.path.join(OUT, "main.html"), os.path.join(OUT, "main.pdf"))
        marks3 = {k: v + 1 for k, v in find_markers(os.path.join(OUT, "main.pdf")).items()}
        assert marks3 == toc, (marks3, toc)
        assert len(PdfReader(os.path.join(OUT, "main.pdf")).pages) == n_before
        b.close()

    w = PdfWriter()
    for f in ["cover.pdf", "main.pdf"]:
        for page in PdfReader(os.path.join(OUT, f)).pages:
            w.add_page(page)
    n = len(w.pages)
    footer_overlay(n, fr, fs, os.path.join(OUT, "footer.pdf"))
    ov = PdfReader(os.path.join(OUT, "footer.pdf"))
    for i, page in enumerate(w.pages):
        page.merge_page(ov.pages[i])
    total = sum(len(q) for _, q in THEMES)
    w.add_metadata({"/Title": f"{build.BRAND} – Examen civique ({build.LIST_NAME}) : les {total} questions et réponses",
                    "/Author": build.BRAND, "/Subject": f"Préparation à l'examen civique ({build.LIST_NAME.lower()})"})
    final = os.path.abspath(TARGET)
    with open(final, "wb") as f:
        w.write(f)
    print("pages", n, final)
    # Inventaire des livrets (lu par scripts/build.mjs pour afficher le nombre de pages)
    inv_path = os.path.join(HERE, "..", "..", "assets", "livrets.json")
    inv = json.load(open(inv_path, encoding="utf-8")) if os.path.exists(inv_path) else {}
    inv[LISTE] = {"fichier": FICHIERS[LISTE], "pages": n, "questions": total}
    json.dump(inv, open(inv_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
