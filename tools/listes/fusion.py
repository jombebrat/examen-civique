# -*- coding: utf-8 -*-
"""Ajoute les listes officielles CSP et CR au site.

Lit data/sources/listes-csp-cr.txt (relevé des listes officielles) et les réponses rédigées
dans contenu_a.py / contenu_b.py, puis écrit :
  - data/questions.json : les nouvelles questions (identifiants csp-T-N / cr-T-N) ;
  - data/listes.json    : l'ordre officiel de chaque liste et sa formulation exacte.
À relancer seulement si les listes officielles changent.
"""
import json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from contenu_a import C as CA, EG  # noqa: E402
from contenu_b import C as CB      # noqa: E402

CONTENU = {**CA, **CB}


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("’", "'").replace("œ", "oe")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def lire_listes():
    lists, cur, th = {}, None, None
    with open(os.path.join(ROOT, "data/sources/listes-csp-cr.txt"), encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            if line.startswith("## "):
                cur = line[3:].lower(); lists[cur] = []; continue
            if line.startswith("# "):
                if line[2:].strip().isdigit():
                    th = int(line[2:])
                continue
            lists[cur].append((th, line))
    return lists


def main():
    qpath = os.path.join(ROOT, "data/questions.json")
    data = json.load(open(qpath, encoding="utf-8"))
    nat_q = [q for q in data["questions"] if re.fullmatch(r"[1-5]-\d+", q["id"])]
    data["questions"] = list(nat_q)  # repart des seules questions « naturalisation » (script rejouable)
    nat = {norm(q["question"]): q["id"] for q in nat_q}
    by_id = {q["id"]: q for q in nat_q}
    lists = lire_listes()

    # 1. Questions absentes de la liste naturalisation, numérotées dans l'ordre d'apparition (CSP puis CR)
    order, first = [], {}
    for L in ("csp", "cr"):
        pos = {}
        for t, txt in lists[L]:
            pos[t] = pos.get(t, 0) + 1
            n = norm(txt)
            if n in nat or n in first:
                continue
            first[n] = (len(order) + 1, L, t, pos[t], txt)
            order.append(n)
    assert len(order) == len(CONTENU), (len(order), len(CONTENU))

    # 2. Résolution : identifiant de la question qui porte la réponse
    resolved = {}

    def resolve(k):
        if k in resolved:
            return resolved[k]
        c = CONTENU[k]
        _, L, t, p, txt = first[order[k - 1]]
        if c[0] == "=":
            target = c[1]
            rid = nat[norm(target)] if target == EG else target
            assert rid in by_id, (k, rid)
        elif c[0] == "~":
            rid = resolve(c[1])
        else:
            rid = f"{L}-{t}-{p}"
            rep, expl, bonne, mauvaises = c
            assert len(mauvaises) == 3 and len({bonne, *mauvaises}) == 4, k
            q = {"id": rid, "theme": t, "numero": p, "question": txt, "reponse": rep, "explication": expl,
                 "complement_hors_livret": "", "reponse_hors_livret": False, "livret_pages": "",
                 "qcm": {"bonne": bonne, "mauvaises": mauvaises}}
            data["questions"].append(q); by_id[rid] = q
        resolved[k] = rid
        return rid

    for k in range(1, len(order) + 1):
        resolve(k)

    # 3. Listes officielles : ordre, thème, numéro, question et formulation exacte si elle diffère
    meta = {
        "csp": {"nom": "Carte de séjour pluriannuelle", "court": "CSP", "slug": "carte-de-sejour-pluriannuelle"},
        "cr": {"nom": "Carte de résident", "court": "CR", "slug": "carte-de-resident"},
    }
    out = {}
    for L in ("csp", "cr"):
        items, pos = [], {}
        for t, txt in lists[L]:
            pos[t] = pos.get(t, 0) + 1
            n = norm(txt)
            qid = nat.get(n) or resolved[first[n][0]]
            e = {"theme": t, "numero": pos[t], "id": qid}
            if norm(by_id[qid]["question"]) != n:
                e["texte"] = txt
            items.append(e)
        out[L] = {**meta[L], "source": "formation-civique.interieur.gouv.fr, liste officielle des questions de connaissance (relevé du 21 octobre 2026)", "questions": items}

    with open(qpath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2); f.write("\n")
    with open(os.path.join(ROOT, "data/listes.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2); f.write("\n")
    news = [q for q in data["questions"] if not re.fullmatch(r"[1-5]-\d+", q["id"])]
    print(f"questions : {len(nat_q)} naturalisation + {len(news)} nouvelles = {len(data['questions'])}")
    for L in out:
        ids = [e["id"] for e in out[L]["questions"]]
        print(f"{L}: {len(ids)} entrées, {len(set(ids))} questions distinctes, "
              f"{sum(1 for i in set(ids) if re.fullmatch(r'[1-5]-[0-9]+', i))} communes avec la naturalisation, "
              f"{sum(1 for e in out[L]['questions'] if 'texte' in e)} formulations différentes")


if __name__ == "__main__":
    main()
