#!/usr/bin/env python3
"""Draft degree information from an official faculty abbreviation list
("Abkürzungen" / Abkürzungsverzeichnis: columns Fachkürzel | Typ | Fach).

Usage:
    python3 degreeinformation/parse_list.py <list.pdf> [--outdir DIR]

What it does (rules: instructions.md in this folder, "Source A"):
  1. Reads word positions (pdftotext -bbox) and finds the three columns from
     the header words "Fachkürzel", "Typ", "Fach" on each page.
  2. Rebuilds rows: a word in the code column starts a new row; name words
     below it (wrapped names) belong to the same row. Page headers and
     footers are skipped.
  3. Groups rows by code (exact spelling), cleans each name (drops a leading
     repetition of the code, drops trailing course-type words such as
     "Praktikum" / "Übung"), and picks one German name per code.
  4. Prints the rows per code, the chosen name, and ISSUES; writes
     <outdir>/degreeinformation_<faculty>_draft.json with "en" left empty.

The English names must be filled in afterwards (translation), so the draft
deliberately fails validation until then. Exit code 0 = no issues, 2 = issues
need a decision (usually a question for the user), 1 = not recognised.
Needs: poppler-utils.
"""
import argparse
import json
import re
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path
from xml.etree import ElementTree as ET

# Course-type words that are not part of the subject name (checked at the end of a name).
TYPE_WORDS = ("Praktikum", "Pr", "Übung", "Übungen", "Uebung", "Ue", "Seminar", "Vorlesung", "SU")


def pages(pdf):
    xml = subprocess.run(["pdftotext", "-bbox", str(pdf), "-"], capture_output=True, text=True, check=True).stdout
    root = ET.fromstring(re.sub(r'xmlns="[^"]+"', "", xml))
    for page in root.iter("page"):
        yield [(w.text or "", float(w.get("xMin")), float(w.get("yMin")), float(w.get("xMax")))
               for w in page.iter("word")]


def norm(s):
    return re.sub(r"\s+", "", s).lower()


def clean_name(code, name):
    n = " ".join(name.split())
    # leading repetition of the code, possibly with spaces or glued to the next word
    c = norm(code)
    squashed = ""
    for i, ch in enumerate(n):
        if not ch.isspace():
            squashed += ch.lower()
        if squashed == c:
            rest = n[i + 1:]
            glued = rest[:1] not in ("", " ")
            # "mMEC5/2B Höhere..." for code "mMEC5/2": the glued "B" belongs to another code; keep
            if glued and len(rest.split()[0]) <= 2:
                break
            n = rest.lstrip()
            break
        if not c.startswith(squashed):
            break
    changed = True
    while changed:
        changed = False
        for t in TYPE_WORDS:
            if n.endswith(" " + t) or n == t:
                n = n[: -len(t)].rstrip()
                changed = True
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--outdir", default=".")
    args = ap.parse_args()

    rows, meta, issues = [], {}, []
    for words in pages(args.pdf):
        head = {w[0]: w for w in words if w[0] in ("Fachkürzel", "Typ", "Fach")}
        if len(head) < 3:
            if words:
                print("Page without the header 'Fachkürzel Typ Fach'; layout differs. Work by hand.")
                return 1
            continue
        # column boundaries: halfway between the code and type headers; a little right of the type header
        x_type = (head["Fachkürzel"][3] + head["Typ"][1]) / 2
        x_name = head["Typ"][3] + 15
        y_top = max(w[2] for w in head.values()) + 5
        text = " ".join(w[0] for w in words)
        m = re.search(r"Fakultät:\s*(\S+)", text)
        if m:
            meta["faculty"] = m.group(1)
        m = re.search(r"\b(wi|so|ws|ss)\s*(\d{2})(?:/(\d{2}))?", text, re.I)
        if m:
            meta["semester"] = m.group(0)
        # page footer ("Seite N Fakultät: ..."); the "wi26/27 Stand ..." line sits above the header
        footer_y = min((w[2] for w in words if w[0] == "Seite" and w[2] > y_top), default=1e9)
        body = sorted((w for w in words if y_top < w[2] < footer_y - 2), key=lambda w: (round(w[2]), w[1]))
        current = None
        for text_, x0, y0, _ in body:
            if x0 < x_type:
                current = {"code": text_, "type": "", "name": [], "y": y0, "ly": None}
                rows.append(current)
            elif current is None:
                issues.append(f"text before the first code on a page: {text_!r}")
            elif x0 < x_name and abs(y0 - current["y"]) < 3 and not current["name"]:
                current["type"] += text_
            else:
                # wrapped names: join a line ending in "-" without a space ("Licht-" + "Simulation")
                if current["name"] and current["ly"] is not None and abs(y0 - current["ly"]) > 3 \
                        and current["name"][-1].endswith("-"):
                    current["name"][-1] += text_
                else:
                    current["name"].append(text_)
                current["ly"] = y0

    if not rows:
        print("No rows found; layout differs. Work by hand.")
        return 1

    by_code = OrderedDict()
    for r in rows:
        r["raw"] = " ".join(r["name"])
        r["clean"] = clean_name(r["code"], r["raw"])
        by_code.setdefault(r["code"], []).append(r)

    lower = {}
    for code in by_code:
        lower.setdefault(code.lower(), []).append(code)
    for variants in lower.values():
        if len(variants) > 1:
            issues.append(f"codes differing only in letter case: {variants} (kept separately)")

    subjects = []
    for code, rs in by_code.items():
        names = OrderedDict((r["clean"], r) for r in rs)
        su = OrderedDict((r["clean"], r) for r in rs if "SU" in r["type"].split("/"))
        chosen = None
        if len(names) == 1:
            chosen = next(iter(names))
        elif len(su) == 1:
            chosen = next(iter(su))
            issues.append(f"INFO {code}: rows differ, used the SU row: "
                          + " | ".join(f"{r['type']}: {r['raw']!r}" for r in rs))
        else:
            issues.append(f"{code}: rows name different subjects, no single SU row to prefer: "
                          + " | ".join(f"{r['type']}: {r['raw']!r}" for r in rs))
            chosen = next(iter(su or names))
        if not chosen:
            issues.append(f"{code}: name is empty after removing code and type words: "
                          + " | ".join(f"{r['type']}: {r['raw']!r}" for r in rs))
        else:
            first = chosen.split()[0]
            if first != chosen and first != code and first.lower().startswith(code.lower()[:3]) \
                    and re.search(r"\d", first):
                issues.append(f"{code}: name starts with a different code {first!r}: {chosen!r}")
        subjects.append({
            "name": {"de": chosen or "", "en": ""},
            "sws": {"lecture": 0, "exercise": 0, "laboratory": 0},
            "code": code,
            "description": {"de": "", "en": ""},
            "test": {"de": "", "en": ""},
        })
        print(f"{code:14} {chosen!r:60} <- " + " | ".join(f"{r['type']}: {r['raw']}" for r in rs))

    fac = meta.get("faculty", "faculty")
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"degreeinformation_{fac}_draft.json"
    path.write_text(json.dumps({"subjects": subjects}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{len(rows)} rows, {len(subjects)} codes; faculty {fac!r}, semester {meta.get('semester')!r}")
    print(f"wrote {path} (fill in every 'name.en', sws, description and test before validating)")
    real = [i for i in issues if not i.startswith("INFO ")]
    if issues:
        print("\nISSUES:")
        for i in issues:
            print(" -", i)
    return 2 if real else 0


if __name__ == "__main__":
    sys.exit(main())
