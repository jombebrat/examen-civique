# -*- coding: utf-8 -*-
"""Produit data/situations.json à partir de source_a.py et source_b.py (mises en situation rédigées par Coq Civique)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from source_a import S as A  # noqa: E402
from source_b import S as B  # noqa: E402
items, pos = [], {}
for t, principe, sit, q, bonne, mauvaises, expl in A + B:
    pos[t] = pos.get(t, 0) + 1
    assert len(mauvaises) == 3 and len({bonne, *mauvaises}) == 4, sit
    items.append({"id": f"s{t}-{pos[t]}", "theme": t, "numero": pos[t], "principe": principe, "situation": sit, "question": q,
                  "qcm": {"bonne": bonne, "mauvaises": mauvaises}, "explication": expl})
out = {"source": "Exercices rédigés par Coq Civique pour s'entraîner aux mises en situation (non officiels).", "mise_a_jour": "2026-10-21", "situations": items}
json.dump(out, open(os.path.join(ROOT, "data/situations.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(len(items), "situations :", pos)
