#!/usr/bin/env python3
"""Draft a .timetable file from a TH Nürnberg timetable PDF (Stundenplan).

Usage:
    python3 timetable/parse.py <timetable.pdf> [--outdir DIR]

What it does (see instructions.md in this folder for the rules it implements):
  1. Renders the page at 300 dpi (pdftoppm) and finds every outlined box
     (thin rectangular outlines of any saturated colour).
  2. Uses boxes labelled with a time range (8:00-9:30, 8.00 - 9.30, ...) as
     the row grid and boxes labelled with a day (German or English, plus a
     Saturday/block column) as day columns.
  3. Assigns text-layer lines (pdftotext -bbox-layout) to boxes by centre.
  4. Parses each box (prefix, NAME:KIND:GROUP, brackets, professors, room,
     #bei Bedarf) and converts box edges to times (linear interpolation,
     rounded to 15 min, gaps snap to the nearer row boundary).
  5. Cross-checks: red pixels in a box must match a printed repeat prefix.
  6. Prints a review table and a list of ISSUES, and writes
     <outdir>/timetable_<code>_<half><year>.timetable.

It was built on one faculty's layout (see instructions.md in this folder,
"Reference layout"). Other layouts may need the options below, or manual
work. It is a drafting aid, not an oracle. Always look at the rendered page (the
PNG is written next to the output as <code>_page.png) and check the review
table against it. Exit code 0 = no issues found; 2 = issues found (resolve
them, usually by asking the user, before delivering); 1 = could not parse.
Needs: poppler-utils, pillow, numpy, scipy.
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
from PIL import Image
from scipy import ndimage

DPI = 300
SCALE = DPI / 72
DAYS = {
    "montag": "monday",
    "monday": "monday",
    "mo": "monday",
    "dienstag": "tuesday",
    "tuesday": "tuesday",
    "di": "tuesday",
    "mittwoch": "wednesday",
    "wednesday": "wednesday",
    "mi": "wednesday",
    "donnerstag": "thursday",
    "thursday": "thursday",
    "do": "thursday",
    "freitag": "friday",
    "friday": "friday",
    "fr": "friday",
}
OTHER_DAY = re.compile(r"samstag|saturday|block|n\.\s*v\.", re.I)
DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "other"]


def _schema_enums():
    """Allowed kinds and weekly repeat types come from timetable/schema.json, so
    a schema update is picked up without editing this script."""
    schema = json.loads((Path(__file__).resolve().parent / "schema.json").read_text())
    item = schema["items"]["properties"]
    kinds = tuple(item["kind"]["items"]["enum"])
    types = ()
    for branch in item["repeat"]["oneOf"]:
        enum = branch["properties"]["type"].get("enum")
        if enum:
            types = tuple(t for t in enum if t != "A")
    return kinds, types


KINDS, PREFIXES = _schema_enums()
ROOM = re.compile(r"\b[A-Z]{2,3}\.\d{2,4}[a-z]?\b")
TIME_LABEL = re.compile(
    r"^(\d{1,2})[:.](\d{2})\s*(?:-|–|bis)\s*(\d{1,2})[:.](\d{2})(?:\s*Uhr)?$"
)
# A bracket hint with a trailing programme code (another timetable), e.g. "MOD:SU XYZ4".
PROGRAMME_SUFFIX = re.compile(r"^(\S+)\s+(\S+)$")


def day_of(label):
    t = label.strip().lower().rstrip(".")
    if t in DAYS:
        return DAYS[t]
    if OTHER_DAY.search(label):
        return "other"
    return None


def render(pdf, workdir):
    stem = Path(workdir) / "page"
    subprocess.run(
        ["pdftoppm", "-r", str(DPI), "-png", "-f", "1", "-l", "1", str(pdf), str(stem)],
        check=True,
    )
    png = sorted(Path(workdir).glob("page*.png"))[0]
    return png, np.array(Image.open(png).convert("RGB")).astype(int)


def find_boxes(img):
    """Thin rectangular outlines of any saturated colour (or dark lines as fallback)."""
    sat = img.max(axis=2) - img.min(axis=2)
    for mask in (sat > 120, img.max(axis=2) < 90):
        lab, _ = ndimage.label(mask)
        out = []
        for i, sl in enumerate(ndimage.find_objects(lab), 1):
            y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
            h, w = y1 - y0, x1 - x0
            if h < 40 or w < 40:
                continue
            filled = (lab[sl] == i).sum()
            if filled < 0.35 * h * w:  # an outline, not a filled blob or text
                out.append((x0, y0, x1, y1))
        if len(out) >= 10:
            return sorted(out, key=lambda t: (t[0], t[1]))
    return []


def text_lines(pdf):
    xml = subprocess.run(
        ["pdftotext", "-bbox-layout", "-f", "1", "-l", "1", str(pdf), "-"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    root = ET.fromstring(re.sub(r'xmlns="[^"]+"', "", xml))
    lines = []
    for ln in root.iter("line"):
        ws = list(ln.iter("word"))
        if not ws:
            continue
        xs = [float(w.get(k)) * SCALE for w in ws for k in ("xMin", "xMax")]
        ys = [float(w.get(k)) * SCALE for w in ws for k in ("yMin", "yMax")]
        lines.append(
            {
                "text": " ".join(w.text for w in ws),
                "x0": min(xs),
                "y0": min(ys),
                "x1": max(xs),
                "y1": max(ys),
            }
        )
    return lines


def inside(line, box):
    x0, y0, x1, y1 = box
    cx, cy = (line["x0"] + line["x1"]) / 2, (line["y0"] + line["y1"]) / 2
    return x0 < cx < x1 and y0 < cy < y1


def to_min(h, m):
    return int(h) * 60 + int(m)


def edge_to_time(y, rows, tol=8):
    """rows: list of (top_y, bottom_y, start_min, end_min)."""
    for top, bot, s, e in rows:
        if top - tol <= y <= bot + tol:
            yy = min(max(y, top), bot)
            v = s + (yy - top) / (bot - top) * (e - s)
            break
    else:  # in a break between rows: snap to the nearer boundary
        cands = [(abs(y - top), s) for top, _, s, _ in rows] + [
            (abs(y - bot), e) for _, bot, _, e in rows
        ]
        v = min(cands)[1]
    v = int(round(v / 15) * 15)
    return {"hour": v // 60, "minute": v % 60}


def parse_title(src):
    parts = src.split(":")
    if len(parts) < 2:
        return None
    entry = {"name": parts[0], "kind": parts[1].split("/")}
    if len(parts) > 2 and parts[2]:
        cat, _, idx = parts[2].partition(".")
        if not (cat.isdigit() and idx.isdigit()):
            return None
        entry["group"] = {"category": int(cat), "index": int(idx)}
    return entry


def parse_box(line_texts, issues, where, prefixes=PREFIXES, kinds=KINDS, room=ROOM):
    """line_texts: text-layer lines of one box, top to bottom."""
    full = " ".join(line_texts)
    on_demand = "bei Bedarf" in full
    brackets = [b.strip() for b in re.findall(r"\[([^\]]*)\]", full)]
    rooms = room.findall(full)
    if len(rooms) != 1:
        issues.append(f"{where}: expected exactly one room, found {rooms}: {full!r}")
    rtype, title, profs = "A", None, []
    for i, ln in enumerate(line_texts):
        t = re.sub(r"\[[^\]]*\]", " ", ln)
        t = t.replace("#bei Bedarf", " ").replace("bei Bedarf", " ")
        t = room.sub(" ", t)
        toks = t.split()
        if title is None and i == 0 and toks and toks[0] in prefixes:
            rtype = toks.pop(0)
        if title is None and toks and ":" in toks[0]:
            title = toks.pop(0)
        if toks:
            profs.append(" ".join(toks))
    if (
        title is None
        and rtype == "A"
        and profs
        and re.fullmatch(r"[A-Z]{1,3}\d?", profs[0].split()[0])
    ):
        issues.append(
            f"{where}: unknown leading marker {profs[0].split()[0]!r} (not in repeat-type enum?)"
        )
    if title is None:  # bracket-only cell
        own = [b for b in brackets if not PROGRAMME_SUFFIX.match(b)]
        if len(own) == 1:
            src = own[0]
            if brackets and brackets[0] != own[0]:
                issues.append(
                    f"{where}: INFO bracket-only cell; used own-programme bracket [{own[0]}] "
                    f"instead of first bracket [{brackets[0]}] (see instructions rule 8)"
                )
        elif brackets:
            src = brackets[0].split()[0]
            issues.append(
                f"{where}: bracket-only cell without exactly one own-programme bracket {brackets}; "
                f"took {src!r} from the first one - confirm with the user"
            )
        else:
            issues.append(f"{where}: no NAME:KIND title found: {full!r}")
            return None
    else:
        src = title
    entry = parse_title(src)
    if entry is None:
        issues.append(f"{where}: title {src!r} does not match NAME:KIND[:GROUP]")
        return None
    bad = [k for k in entry["kind"] if k not in kinds]
    if bad:
        issues.append(f"{where}: kind {bad} not allowed by the schema ({src!r})")
    return (
        rtype,
        entry,
        ", ".join(profs),
        (rooms[0] if rooms else ""),
        on_demand,
        brackets,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--outdir", default=".")
    ap.add_argument(
        "--prefixes",
        help="comma-separated repeat markers (default: %s)" % ",".join(PREFIXES),
    )
    ap.add_argument(
        "--kinds",
        help="comma-separated allowed kinds (default from schema.json: %s)"
        % ",".join(KINDS),
    )
    ap.add_argument(
        "--room-regex", help="regex for room codes (default: %s)" % ROOM.pattern
    )
    ap.add_argument("--code", help="timetable code, if the header cannot be parsed")
    args = ap.parse_args()
    prefixes = tuple(args.prefixes.split(",")) if args.prefixes else PREFIXES
    kinds = tuple(args.kinds.split(",")) if args.kinds else KINDS
    room_re = re.compile(args.room_regex) if args.room_regex else ROOM
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    issues = []

    with tempfile.TemporaryDirectory() as tmp:
        png, img = render(args.pdf, tmp)
        boxes = find_boxes(img)
        lines = text_lines(args.pdf)
        if not boxes:
            print(
                "No outlined boxes found; the layout differs from the reference. Work by hand."
            )
            return 1

        # Header: code, half, year
        head = sorted(
            (l for l in lines if l["y1"] < min(b[1] for b in boxes)),
            key=lambda l: l["x0"],
        )
        header = " ".join(l["text"] for l in head)
        m = re.search(r"(Winter|Sommer|Summer)\s*(\d{2})(?:/\d{2})?", header)
        # the code is printed at the right end of the header, after "Fakultät <faculty>"
        code_m = re.search(r"Fakultät\s+\S+\s+([A-Z][A-Za-z0-9-]*)\s*$", header)
        if not m:
            print(
                f"No Winter/Sommer semester in header {header!r}; read it from the image or ask."
            )
            return 1
        half = "winter" if m.group(1) == "Winter" else "summer"
        year = 2000 + int(m.group(2))
        code = args.code or (code_m.group(1) if code_m else None)
        if not code:
            print(
                f"Could not find the timetable code in header {header!r}; read it from the image "
                f"and rerun with --code (ask the user if it is not printed)."
            )
            return 1

        # Classify boxes: time labels, day headers, subjects
        rows, days, subjects = [], [], []
        for b in boxes:
            txt = " ".join(l["text"] for l in lines if inside(l, b)).strip()
            tm = TIME_LABEL.match(txt)
            if tm:
                rows.append(
                    (b[1], b[3], to_min(*tm.group(1, 2)), to_min(*tm.group(3, 4)))
                )
            elif day_of(txt):
                days.append((b[0], b[2], day_of(txt)))
            else:
                subjects.append((b, txt))
        rows.sort()
        dnames = [d for _, _, d in days]
        if len(rows) < 2 or len(days) < 5 or len(set(dnames)) != len(dnames):
            print(
                f"Grid not recognised (day columns={dnames}, time rows={len(rows)}); "
                f"the layout differs from the reference. Work by hand; ask the user where unsure."
            )
            return 1
        if len(days) != 6:
            issues.append(f"INFO {len(days)} day columns found: {dnames}")

        r, g, bl = img[..., 0], img[..., 1], img[..., 2]
        red = (r > 200) & (g < 80) & (bl < 80)
        border = (
            5  # px of the box outline below the content, compensates label vs box edge
        )
        result = []
        for b, _ in subjects:
            x0, y0, x1, y1 = b
            col = [d for a, e, d in days if a - 10 <= x0 and x1 <= e + 10]
            where = f"box@x{x0},y{y0}"
            if len(col) != 1:
                issues.append(f"{where}: cannot assign to one day column")
                continue
            box_lines = sorted(
                (l for l in lines if inside(l, b)), key=lambda l: (l["y0"], l["x0"])
            )
            # rotated boxes: pdftotext reports each rotated line as its own column; order by x instead
            if box_lines and all(
                l["y1"] - l["y0"] > l["x1"] - l["x0"] for l in box_lines
            ):
                box_lines.sort(key=lambda l: l["x0"])
            texts = [l["text"] for l in box_lines]
            parsed = parse_box(
                texts, issues, f"{col[0]} {where}", prefixes, kinds, room_re
            )
            if parsed is None:
                continue
            rtype, entry, prof, room, od, brackets = parsed
            # repeat markers are red in the reference layout; skip if the outlines themselves are red
            has_red = red[y0 + 6 : y1 - 6, x0 + 6 : x1 - 6].sum() > 50
            if has_red != (rtype != "A"):
                issues.append(
                    f"{col[0]} {where}: red pixels={has_red} but prefix={rtype}; check the image"
                )
            start, end = edge_to_time(y0, rows), edge_to_time(y1 - border, rows)
            dur = to_min(end["hour"], end["minute"]) - to_min(
                start["hour"], start["minute"]
            )
            if dur not in (90, 195):
                issues.append(
                    f"{col[0]} {where}: INFO unusual duration {dur} min ({entry['name']}); re-check edges"
                )
            rep = {"type": rtype, "day": col[0]}
            if prof:
                rep["professor"] = prof
            if room:
                rep["location"] = room
            rep["startTime"], rep["endTime"] = start, end
            item = {"repeat": rep, **entry, "onDemand": od}
            if brackets:
                item["note"] = "; ".join(brackets)
            result.append(item)

        Image.open(png).save(outdir / f"{code}_page.png")

    order = DAY_ORDER
    result.sort(
        key=lambda e: (
            order.index(e["repeat"]["day"]),
            to_min(
                e["repeat"]["startTime"]["hour"], e["repeat"]["startTime"]["minute"]
            ),
        )
    )
    print(f"{code}, {half} {year}: {len(result)} subjects\n")
    for e in result:
        rp = e["repeat"]
        grp = f"{e['group']['category']}.{e['group']['index']}" if "group" in e else "-"
        print(
            f"{rp['type']:3} {rp['day'][:3]} {rp['startTime']['hour']:02}:{rp['startTime']['minute']:02}-"
            f"{rp['endTime']['hour']:02}:{rp['endTime']['minute']:02}  {e['name']}:{'/'.join(e['kind'])}:{grp}"
            f"  | {rp.get('professor', '')} | {rp.get('location', '')}"
            f"{' | onDemand' if e['onDemand'] else ''}{' | note: ' + e['note'] if 'note' in e else ''}"
        )
    out = outdir / f"timetable_{code}_{half}{year}.timetable"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nwrote {out}")
    real = [i for i in issues if "INFO " not in i]
    if issues:
        print("\nISSUES:")
        for i in issues:
            print(" -", i)
    return 2 if real else 0


if __name__ == "__main__":
    sys.exit(main())
