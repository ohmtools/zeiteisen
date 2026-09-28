#!/usr/bin/env python3
"""Read the credit points (LP / ECTS) per module from a programme's study plan
("Studienplan", with the table "Studienverlaufsplan" and elective catalogues).
This is step 1b of the degree task.

Usage:
    python3 degree/parse_studyplan.py <studyplan.pdf> [--outdir DIR] [--major SLUG]

What it does (rules: instructions.md in this folder, step 1b):
  1. Reads word positions (pdftotext -bbox) and finds every table whose header
     line contains the words "SWS" and "LP"; the name column comes from a
     header word like "Modulname" / "Modul" / "Fach" / "Lehrveranstaltung".
     A table that runs on to the next page without repeating its header keeps
     its columns there (INFO), until a header, footnote or section ends it.
  2. Rebuilds rows: a module identifier (e.g. `1`, `15a`, `MOD2`, `MOD2/1`)
     left of the name, the name (wrapped lines joined), and the numbers under
     the SWS and LP headers. A row without LP is a group heading
     (e.g. `MOD2  Beispielgruppe` followed by `MOD2/1`, `MOD2/2`).
  3. Tables whose header starts with "Sem" are the semester plan: rows of one
     identifier in several semesters are summed (a module taught over two
     semesters). All other tables are catalogues (electives); an identifier
     repeated there is the same module and must carry the same LP.
  4. Cross-checks every "Summe" line of the semester plan against the rows
     above it (a COMPLETENESS issue means a row was missed or misread).
  5. Prints every module with its LP, and ISSUES; writes
     <outdir>/plan_<major>.json: {"source", "modules": [{"id", "name", "lp",
     "sws", "rows", "parent", "parts", "slot"}]}. A working file, not a
     deliverable.

`slot` marks placeholder rows for an elective slot (names containing
"Wahlpflicht", "FWPM", "AWPM"): their LP belong to the slot, never to a
single catalogue module. `parent` / `parts` link parts (`15a`, `MOD2/1`) to
their whole module; a parent's `lp` is the sum of its parts when the plan
gives no own value ("derived": true).

Exit code 0 = no issues, 2 = issues need a decision, 1 = not recognised.
Needs: poppler-utils.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

NAME_HEADERS = ("Modulname", "Modulbezeichnung", "Lehrveranstaltung", "Fach", "Modul", "Bezeichnung")
ID_RE = re.compile(r"^[A-Za-z]{0,8}-?\d+[A-Za-z]?(?:[/.]\d+[A-Za-z]?)?$")
NUM_RE = re.compile(r"^\d+(?:[.,]\d+)?$")
SLOT_RE = re.compile(r"wahlpflicht|\bFWPM\b|\bAWPM\b", re.IGNORECASE)
STOP_RE = re.compile(r"^(\d+\)|Fußnote|Lesehilfe|Legende)", re.IGNORECASE)
SECTION_RE = re.compile(r"^\d+(\.\d+)+$")
COL_TOL = 16  # points: max distance of a number from its header column centre


def words_by_page(pdf):
    xml = subprocess.run(
        ["pdftotext", "-bbox", str(pdf), "-"], capture_output=True, text=True, check=True
    ).stdout
    root = ET.fromstring(re.sub(r'xmlns="[^"]+"', "", xml))
    for n, page in enumerate(root.iter("page"), 1):
        ws = []
        for w in page.iter("word"):
            x0, y0, x1, y1 = (float(w.get(k)) for k in ("xMin", "yMin", "xMax", "yMax"))
            if (y1 - y0) > 2.2 * max(x1 - x0, 1) and (y1 - y0) > 14:
                continue  # rotated label (e.g. a vertical "1. Semester")
            ws.append({"t": w.text or "", "x0": x0, "x1": x1, "y": y0, "h": y1 - y0})
        yield n, ws


def lines_of(ws):
    lines = []
    for w in sorted(ws, key=lambda w: (w["y"], w["x0"])):
        if lines and abs(lines[-1][0]["y"] - w["y"]) <= 2.5:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [sorted(l, key=lambda w: w["x0"]) for l in lines]


def centre(w):
    return (w["x0"] + w["x1"]) / 2


def lp_text(v):
    """An LP value for a message; `?` when none could be read."""
    return "?" if v is None else f"{v:g}"


def parse_number(t):
    if not NUM_RE.match(t):
        return None
    v = float(t.replace(",", "."))
    return int(v) if v.is_integer() else v


def header_of(line):
    texts = [w["t"] for w in line]
    if "SWS" not in texts or "LP" not in texts:
        return None
    name = next((w for h in NAME_HEADERS for w in line if w["t"] == h), None)
    if name is None:
        return None
    right = [w["x0"] for w in line if w["x0"] > name["x1"] + 2]
    return {
        "sws": centre(next(w for w in line if w["t"] == "SWS")),
        "lp": centre(next(w for w in line if w["t"] == "LP")),
        "name_x0": name["x0"],
        "name_x1": min(right) if right else 10_000,
        "timeline": texts[0].lower().startswith("sem"),
        "y": line[0]["y"],
    }


def parse_row(line, hd):
    """Return (id, name_words, sws, lp) or None for lines that are no row."""
    ident, rest = None, []

    def in_number_column(w):
        return min(abs(centre(w) - hd["sws"]), abs(centre(w) - hd["lp"])) <= COL_TOL

    for w in line:
        if in_number_column(w):
            rest.append(w)
            continue
        if ident is None and not rest and ID_RE.match(w["t"]) and w["x0"] < hd["name_x0"] + 12:
            ident = w  # keep the rightmost leading identifier (Modul / Modul-ID columns)
            continue
        if ident is not None and not rest and ID_RE.match(w["t"]) and w["x1"] < hd["name_x0"] - 2:
            ident = w
            continue
        if ident is None and not rest and w["x1"] < hd["name_x0"] - 14:
            continue  # label in a leading column (e.g. a semester number), not part of the row
        rest.append(w)
    name = [
        w for w in rest
        if w["x0"] >= hd["name_x0"] - 12 and w["x0"] < hd["name_x1"] - 2
        and not (parse_number(w["t"]) is not None and in_number_column(w))
    ]
    nums = [w for w in rest if w not in name and parse_number(w["t"]) is not None]
    dash = [w for w in rest if w not in name and w["t"] in ("-", "--", "–")]

    def pick(col):
        best = min(nums + dash, key=lambda w: abs(centre(w) - col), default=None)
        if best is None or abs(centre(best) - col) > COL_TOL:
            return None
        return parse_number(best["t"]), best

    sws, lp = pick(hd["sws"]), pick(hd["lp"])
    if sws and lp and sws[1] is lp[1]:  # one number claimed by both columns
        if abs(centre(sws[1]) - hd["sws"]) < abs(centre(lp[1]) - hd["lp"]):
            lp = None
        else:
            sws = None
    return ident, name, sws[0] if sws else None, lp[0] if lp else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--outdir", default=".")
    ap.add_argument("--major", default=None)
    a = ap.parse_args()

    rows, issues, tables, checked, block_start = [], [], 0, [], 0
    hd = None
    for page, ws in words_by_page(a.pdf):
        # A table still open at the end of the last page runs on here: it
        # keeps its columns until a header, footnote or section ends it.
        # `carried` notes it once a row comes of it.
        last, carried = None, hd is not None
        for line in lines_of(ws):
            first = line[0]["t"]
            h = header_of(line)
            if h:
                hd, last, tables, carried = h, None, tables + 1, False
                block_start = len(rows)
                continue
            if hd is None:
                continue
            if STOP_RE.match(first) or (SECTION_RE.match(first) and len(line) > 1):
                hd, last = None, None
                continue
            if any(w["t"].lower().startswith("summe") for w in line):
                total = parse_row(line, hd)[3]
                if total is not None and hd["timeline"]:
                    got = sum(r["lp"] or 0 for r in rows[block_start:])
                    if abs(got - total) > 1e-9:
                        issues.append(
                            f"COMPLETENESS p.{page}: rows above a 'Summe' line add up to "
                            f"{got:g} LP, the plan says {total:g}; a row was missed or misread"
                        )
                    checked.append(total)
                block_start, last = len(rows), None
                continue
            ident, name, sws, lp = parse_row(line, hd)
            text = " ".join(w["t"] for w in name)
            if ident is None:
                # wrapped name: text in the name column right below a row, no numbers
                if last and name and len(name) == len(line) and line[0]["y"] - last["y"] < 20:
                    if last["name"].endswith("-") and text[:1].islower():
                        last["name"] = last["name"][:-1] + text  # hyphenated line break
                    elif last["name"].endswith("-"):
                        last["name"] += text
                    else:
                        last["name"] += " " + text
                    last["y"] = line[0]["y"]
                continue
            last = {
                "id": ident["t"], "name": text, "sws": sws, "lp": lp, "page": page,
                "timeline": hd["timeline"], "y": line[0]["y"],
            }
            rows.append(last)
            if carried:
                issues.append(
                    f"INFO p.{page}: a table runs on from the page before without its "
                    f"header; its rows are read with that table's columns, spot-check them"
                )
                carried = False

    if not rows:
        print("NOT RECOGNISED: no table with the header columns SWS and LP and a name column.")
        sys.exit(1)

    # group headings (no LP, no SWS) become parents of the following sub-ids
    modules, order, heading = {}, [], None
    for r in rows:
        key = r["id"]
        if r["lp"] is None and r["sws"] is None:
            heading = key
            if key not in modules:
                modules[key] = {"id": key, "name": r["name"], "lp": None, "sws": None,
                                "rows": [], "parts": [], "heading": True}
                order.append(key)
            continue
        parent = None
        m = re.match(r"^(.*\d)[a-z]$", key)
        sub = "/" in key or "." in key
        if heading and sub:
            parent = heading  # a part listed under a group heading belongs to it
        elif sub:
            parent = re.split(r"[/.]", key)[0]
        elif m:
            parent = m.group(1)
        if not sub:
            heading = None
        if key not in modules:
            modules[key] = {"id": key, "name": r["name"], "lp": None, "sws": None,
                            "rows": [], "parts": [], "parent": parent}
            order.append(key)
        mod = modules[key]
        if mod.get("parent") and parent and mod["parent"] != parent:
            issues.append(f"INFO {key}: listed under {mod['parent']} and {parent}")
            if key not in modules.setdefault(parent, {"id": parent, "name": None, "lp": None,
                                                         "sws": None, "rows": [], "parts": [],
                                                         "heading": True})["parts"]:
                modules[parent]["parts"].append(key)
        mod.setdefault("parent", parent)
        mod["rows"].append({"page": r["page"], "lp": r["lp"], "sws": r["sws"],
                            "timeline": r["timeline"], "name": r["name"]})

    for key in order:
        mod = modules[key]
        if mod.get("heading") and not mod["rows"]:
            continue
        tl = [x for x in mod["rows"] if x["timeline"]]
        cat = [x for x in mod["rows"] if not x["timeline"]]
        if tl:
            lps = [x["lp"] for x in tl]
            if None in lps:
                issues.append(f"{key} ({mod['name']}): a semester-plan row has no readable LP; read the page")
            mod["lp"] = sum(v for v in lps if v is not None) if any(v is not None for v in lps) else None
            mod["sws"] = sum(x["sws"] for x in tl if x["sws"] is not None) or None
            if len(tl) > 1:
                issues.append(f"INFO {key} ({mod['name']}): {len(tl)} semester rows summed to {lp_text(mod['lp'])} LP")
        if cat:
            vals = {x["lp"] for x in cat}
            if len(vals) > 1:
                shown = ", ".join(lp_text(v) for v in sorted(vals, key=lambda v: (v is None, v or 0)))
                issues.append(f"{key} ({mod['name']}): catalogue rows disagree on LP ({shown})")
            elif mod["lp"] is None:
                mod["lp"] = cat[0]["lp"]
                mod["sws"] = cat[0]["sws"]
            elif tl and cat[0]["lp"] is not None and cat[0]["lp"] != mod["lp"]:
                # A catalogue row without LP (a dash) leaves the semester plan's.
                issues.append(f"{key} ({mod['name']}): semester plan says {lp_text(mod['lp'])} LP, catalogue {lp_text(cat[0]['lp'])}")
            names = {x["name"] for x in cat}
            if len(names) > 1:
                issues.append(f"INFO {key}: names differ between catalogues {sorted(names)}; first kept")
        if mod["lp"] is None:
            issues.append(f"{key} ({mod['name']}): no LP found; read the page (p.{mod['rows'][0]['page']})")
        if SLOT_RE.search(mod["name"]):
            mod["slot"] = True
            issues.append(f"INFO {key} ({mod['name']}): elective slot, LP not transferred to catalogue modules")

    for key in order:
        p = modules[key].get("parent")
        if p:
            if p not in modules:
                modules[p] = {"id": p, "name": None, "lp": None, "sws": None, "rows": [],
                              "parts": [], "heading": True}
                order.insert(order.index(key), p)
            if key not in modules[p]["parts"]:
                modules[p]["parts"].append(key)
    for key in order:
        mod = modules[key]
        if mod["parts"] and mod["lp"] is None:
            part_lp = [modules[k]["lp"] for k in mod["parts"]]
            if all(v is not None for v in part_lp) and not any(
                modules[k].get("slot") for k in mod["parts"]
            ):
                mod["lp"], mod["derived"] = sum(part_lp), True

    out_mods = []
    for key in order:
        mod = modules[key]
        rec = {"id": key, "name": mod["name"], "lp": mod["lp"], "sws": mod["sws"],
               "rows": len(mod["rows"])}
        for k in ("parent", "slot", "derived"):
            if mod.get(k):
                rec[k] = mod[k]
        if mod["parts"]:
            rec["parts"] = mod["parts"]
        out_mods.append(rec)

    print(f"tables: {tables}, rows: {len(rows)}, modules: {len(out_mods)}, "
          f"'Summe' lines checked: {len(checked)}")
    if not checked:
        issues.append("INFO no 'Summe' line found: LP not cross-checked, compare with the PDF by hand")
    for m in out_mods:
        flags = [f for f in ("slot", "derived") if m.get(f)]
        parts = f" parts={','.join(m['parts'])}" if m.get("parts") else ""
        lp = lp_text(m["lp"])
        print(f"  {m['id']:<10} {lp:>4} LP  {m['name'] or '(no name)'}{parts}{' [' + ','.join(flags) + ']' if flags else ''}")

    slug = a.major or re.sub(r"[^A-Za-z0-9-]+", "-", Path(a.pdf).stem).strip("-")
    outdir = Path(a.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    out = outdir / f"plan_{slug}.json"
    out.write_text(json.dumps({"source": Path(a.pdf).name, "modules": out_mods},
                              ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"written: {out}")

    if issues:
        print("ISSUES:")
        for i in issues:
            print("  -", i)
    sys.exit(2 if any(not i.startswith("INFO") for i in issues) else 0)


if __name__ == "__main__":
    main()
