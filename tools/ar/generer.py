# -*- coding: utf-8 -*-
"""Produit data/ar.json : l'aide en arabe affichée dans l'application (bouton « AR »).

  q : {identifiant de question : [question, réponse, explication]}
  s : {identifiant de mise en situation : [situation, question, réponse, explication]}

Les traductions sont dans nat_a.py / nat_b.py (liste naturalisation), new.py (questions propres
aux listes CSP et CR, numérotées comme dans tools/listes) et sit.py (mises en situation, même ordre
que tools/situations). Le français reste la référence : l'arabe n'est qu'une aide à la compréhension.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "tools", "listes"))
sys.path.insert(0, os.path.join(ROOT, "tools", "situations"))

from nat_a import E as NA  # noqa: E402
from nat_b import E as NB  # noqa: E402
from new import E as NEW   # noqa: E402
from sit import L as SIT   # noqa: E402
from fusion import norm, lire_listes, CONTENU  # noqa: E402
from source_a import S as SA  # noqa: E402
from source_b import S as SB  # noqa: E402


def main():
    data = json.load(open(os.path.join(ROOT, "data/questions.json"), encoding="utf-8"))
    ids = {q["id"] for q in data["questions"]}
    nat_q = [q for q in data["questions"] if re.fullmatch(r"[1-5]-\d+", q["id"])]
    nat = {norm(q["question"]) for q in nat_q}

    q = {}
    for k, v in {**NA, **NB}.items():
        assert k in ids and len(v) == 3 and v[0].strip() and v[1].strip(), k
        q[k] = v
    missing_nat = [x["id"] for x in nat_q if x["id"] not in q]
    assert not missing_nat, missing_nat

    # Même numérotation que tools/listes/fusion.py : ordre d'apparition (CSP puis CR) hors naturalisation
    lists, order, first = lire_listes(), [], {}
    for L in ("csp", "cr"):
        pos = {}
        for t, txt in lists[L]:
            pos[t] = pos.get(t, 0) + 1
            n = norm(txt)
            if n in nat or n in first:
                continue
            first[n] = (L, t, pos[t])
            order.append(n)
    want = {k for k, c in CONTENU.items() if c[0] not in ("=", "~")}
    assert set(NEW) == want, (sorted(want - set(NEW)), sorted(set(NEW) - want))
    for k, v in NEW.items():
        L, t, p = first[order[k - 1]]
        rid = f"{L}-{t}-{p}"
        assert rid in ids and len(v) == 3 and v[0].strip() and v[1].strip(), (k, rid)
        q[rid] = v
    missing = sorted(i for i in ids if i not in q)
    assert not missing, missing

    # Mises en situation : même ordre que tools/situations/generer.py
    src = SA + SB
    assert len(src) == len(SIT), (len(src), len(SIT))
    s, pos = {}, {}
    for (t, *_), v in zip(src, SIT):
        pos[t] = pos.get(t, 0) + 1
        assert len(v) == 4 and all(x.strip() for x in v), v
        s[f"s{t}-{pos[t]}"] = v
    sits = json.load(open(os.path.join(ROOT, "data/situations.json"), encoding="utf-8"))["situations"]
    assert {x["id"] for x in sits} == set(s)

    out = {"note": "Aide en arabe de Coq Civique. Le texte français fait foi ; l'examen civique se passe en français.",
           "q": q, "s": s}
    with open(os.path.join(ROOT, "data/ar.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":")); f.write("\n")
    print(f"ar.json : {len(q)} questions, {len(s)} mises en situation, "
          f"{os.path.getsize(os.path.join(ROOT, 'data/ar.json')) // 1024} Ko")


if __name__ == "__main__":
    main()
