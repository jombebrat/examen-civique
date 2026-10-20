import sys, itertools, pdfplumber
pdf_path = sys.argv[1]
problems = 0
with pdfplumber.open(pdf_path) as pdf:
    print("pages:", len(pdf.pages))
    for pno, page in enumerate(pdf.pages, 1):
        W, H = float(page.width), float(page.height)
        words = page.extract_words(keep_blank_chars=False, use_text_flow=False, extra_attrs=["size"])
        # 1) texte hors page / trop près du bord
        for w in words:
            if w["x0"] < 5 or w["x1"] > W - 5 or w["top"] < 0 or w["bottom"] > H - 5:
                print(f"p{pno}: hors limites -> {w['text']!r} ({w['x0']:.1f},{w['top']:.1f})")
                problems += 1
        # 2) chevauchements entre mots
        for a, b in itertools.combinations(words, 2):
            ix = min(a["x1"], b["x1"]) - max(a["x0"], b["x0"])
            iy = min(a["bottom"], b["bottom"]) - max(a["top"], b["top"])
            if ix > 0.6 and iy > 0.6:
                area = ix * iy
                small = min((a["x1"]-a["x0"])*(a["bottom"]-a["top"]), (b["x1"]-b["x0"])*(b["bottom"]-b["top"]))
                if small > 0 and area / small > 0.12:
                    print(f"p{pno}: CHEVAUCHEMENT {a['text']!r} / {b['text']!r} ({area/small:.0%})")
                    problems += 1
        # 3) glyphes de remplacement
        txt = page.extract_text() or ""
        if "�" in txt:
            print(f"p{pno}: glyphe manquant (U+FFFD)"); problems += 1
print("PROBLÈMES:", problems)

# 4) vérification au niveau des caractères (lettres qui se chevauchent sur une même ligne)
char_pb = 0
with pdfplumber.open(pdf_path) as pdf:
    for pno, page in enumerate(pdf.pages, 1):
        chars = [c for c in page.chars if c["text"].strip()]
        chars.sort(key=lambda c: (round(c["top"]), c["x0"]))
        lines = {}
        for c in chars:
            lines.setdefault(round(c["top"] / 1.5), []).append(c)
        for k, L in lines.items():
            L.sort(key=lambda c: c["x0"])
            for a, b in zip(L, L[1:]):
                ix = min(a["x1"], b["x1"]) - max(a["x0"], b["x0"])
                wmin = min(a["x1"] - a["x0"], b["x1"] - b["x0"])
                if wmin > 0 and ix > 0.5 * wmin and abs(a["size"] - b["size"]) < 0.5:
                    print(f"p{pno}: lettres superposées {a['text']!r}{b['text']!r} y={a['top']:.1f}")
                    char_pb += 1
print("CARACTÈRES SUPERPOSÉS:", char_pb)
