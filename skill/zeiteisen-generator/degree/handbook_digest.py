#!/usr/bin/env python3
"""Shrink a module handbook PDF (Modulhandbuch) to a compact, readable digest.

Usage:
    python3 degree/handbook_digest.py <handbook.pdf> [--out FILE]

Module handbooks run 80-260 pages, mostly running headers/footers, layout
whitespace and literature lists. Reading them raw costs far too many tokens.
This script keeps the text and its label/value layout but:

  * removes running page headers/footers and bare page numbers,
  * compresses layout whitespace and drops blank lines,
  * drops literature lists (label "Literatur..." up to the next field label),
  * marks each PDF page as `=== p.N ===`,
  * prints the table of contents (lines with dotted leaders) as an index.

It does NOT decide which text belongs to which module: layouts differ too
much between faculties. Use the index and `grep -n` on the digest to find
each module, then read that range (see instructions.md, step 2).
Needs: poppler-utils (pdftotext).
"""

import argparse
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

DROP_LABEL = re.compile(
    r"^(\s*)(Literatur\w*|Empfohlene Literatur\w*|Literature|Reading list|Kontakt"
    r"|Dozent\S*|Modulverantwort\w*|Kursniveau|Frist des Moduls"
    r"|Datum der letzten Änderung|Voraussetzung für)(:|\s{2,}|\s*$|\s*\()"
)
PAGE_NO = re.compile(
    r"^\s*(-\s*\d+\s*-|\d+\s*(von|/|of)\s*\d+|Seite\s+\d+(\s*(von|/)\s*\d+)?|\d+)\s*$"
)
TOC_LINE = re.compile(r"^(.*?\S)\s*\.{4,}\s*(\d+)\s*$")


def norm(line):
    return re.sub(r"\d+", "#", " ".join(line.split()))


def indent(line):
    return len(line) - len(line.lstrip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--out")
    args = ap.parse_args()

    raw = subprocess.run(
        ["pdftotext", "-layout", args.pdf, "-"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    pages = [p.split("\n") for p in raw.split("\f")]
    if pages and not "".join(pages[-1]).strip():
        pages.pop()

    # running headers/footers: lines (digits normalised) found on >= 85 % of pages.
    # A strict threshold on purpose: repeated field lines such as "Umfang: 4 SWS"
    # must never disappear; a missed header only costs a few tokens.
    seen = Counter()
    for p in pages:
        seen.update({norm(l) for l in p if l.strip()})
    running = {
        k for k, c in seen.items() if len(k) >= 15 and c >= max(3, 0.85 * len(pages))
    }

    toc, out, dropped = [], [], 0
    # while dropping a block: the column its values start in (can span pages);
    # pending = label column of a label line without a value (next line decides)
    drop_col, pending = None, None
    for no, p in enumerate(pages, 1):
        out.append(f"=== p.{no} ===")
        for line in p:
            if not line.strip() or norm(line) in running or PAGE_NO.match(line):
                continue
            m = TOC_LINE.match(line)
            if m and no <= 8:
                toc.append(f"p.{no}: {' '.join(m.group(1).split())} ... {m.group(2)}")
                continue
            ind = indent(line)
            if pending is not None:
                # label without a value: an indented next line holds its value;
                # a line at the label column means the field was empty
                drop_col = ind if ind > pending + 3 else None
                pending = None
            if drop_col is not None:
                # a line starting clearly left of the value column is the next field label
                if ind < drop_col - 6:
                    drop_col = None
                else:
                    dropped += 1
                    continue
            d = DROP_LABEL.match(line)
            if d:
                rest = line[d.end() :]
                if rest.strip():
                    drop_col = len(line) - len(rest.lstrip())
                else:
                    pending = len(d.group(1))
                dropped += 1
                continue
            text = re.sub(r" {3,}", "   ", line.strip())
            out.append(" " * min(ind // 4, 10) + text)

    digest = "\n".join(out) + "\n"
    target = (
        Path(args.out) if args.out else Path(args.pdf).with_suffix(".digest.txt").name
    )
    Path(target).write_text(digest, encoding="utf-8")

    print(
        f"{len(pages)} pages; {len(raw)} -> {len(digest)} chars "
        f"(~{len(digest) // 4} tokens); {dropped} literature/staff/contact lines dropped"
    )
    print(f"digest written to {target}")
    if toc:
        print(f"\nTABLE OF CONTENTS ({len(toc)} entries; page numbers as printed):")
        print("\n".join(toc))
    else:
        print(
            "\nNo table of contents with dotted leaders found; find modules with grep "
            "(e.g. for 'Modul', 'Modulbezeichnung', 'Modultitel')."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
