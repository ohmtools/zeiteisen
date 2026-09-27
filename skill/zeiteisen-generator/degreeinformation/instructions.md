You are building one `degreeinformation` file per degree programme: every
subject with its code, German and English name, SWS per course type, a short
description of what it teaches, and its exam form (`schema.json`).

## Priority: every list code

The most important property of the file is that
**every code of the abbreviation list is in it, spelled exactly as printed**.
Timetables look subjects up by code, so a missing code is the worst possible
error; a missing description or SWS value is minor. `parse_list.py` recounts the
codes from the plain PDF text as a cross-check, and `validate.py --list` fails
if a list code is missing from the output or the list codes aren't first and in
list order. Never deliver a file that fails this check.

## Inputs: the list and the handbook together

Two documents feed one file, and each contributes what the other lacks:

- **The official abbreviation list** (Abkürzungen / Abkürzungsverzeichnis) of
  a faculty: title like "Abkürzungen", a table `Fachkürzel | Typ | Fach`, a
  semester and `Stand` line (e.g. `wi26/27 Stand 15.09.2026`), footer
  `Fakultät: <faculty>`. It holds the **codes exactly as the timetables use
  them** and a German name per code, for every programme of the faculty,
  including course parts, late-starter courses and numbered electives.
- **The module handbook** (Modulhandbuch / module handbook) of one degree
  programme. It holds the details: SWS and course types, exam form, learning
  goals and contents. Codes may be missing entirely (some handbooks only have
  names), or differ from the list's.

Both are needed. If the user gave only one:

- No list: ask for it. Don't search the web for one; lists are issued per
  semester and only the user knows which one applies.
- No handbook: get it from the programme's website (see "Finding a handbook
  online" at the end), or ask if the programme is unclear.

Pairing, when several PDFs are attached: one list plus one handbook per
programme of that faculty; each handbook becomes its own file, and each file
uses the whole list. A German and an English handbook of the same programme
count as one handbook in two languages. Ask when a handbook's programme
belongs to a different faculty than the list, when two handbooks are the same
programme in the same language (editions), or when two lists of one faculty
are attached (semesters / `Stand` dates).

## What goes into the file

- **Every list code**, in list order, enriched with its handbook module when
  one matches (step 3). A list code without a handbook module still goes in,
  with everything that can be said about it (see the field rules). This
  includes codes of the faculty's other programmes, because timetables mix
  them.
- **Then every handbook module with a code that no list entry matched**, in
  handbook order. Handbook modules without any code can't be written (the
  schema requires a code); name them in the chat summary instead.
- Skip handbook entries that are no subjects: group headings such as
  "Wahlpflichtmodule der Gruppe 1", and coded
  placeholders only where the code carries nothing but a pointer to a
  catalogue ("Wahlpflichtmodul 1 (siehe Katalog)") while the catalogue's
  modules are listed themselves.

"Include what you can and move on" is the principle: a missing counterpart
is expected, not a question. Questions are for real conflicts (see "Ask the
user").

## Step 1: read the list

```text
python3 <skill-dir>/degreeinformation/parse_list.py <list.pdf> --outdir <drafts-dir>
```

It rebuilds the table rows (including wrapped names), groups them by code,
applies the rules below, prints each code with its chosen name, recounts the
codes from the plain PDF text (a `COMPLETENESS` issue means codes were missed:
add them by hand from the PDF), and lists ISSUES (exit code 2 = something needs
a decision; `INFO` lines are already decided). It writes the working file
`list_<faculty>.json` (`code`, `de`, `types` per entry). Spot-check it against
the PDF. Without a shell, read the table by hand (`no-shell.md`, section 3).

List rules (already decided, don't ask):

- One entry per code, spelled exactly as printed (`101xyz` and `101XYZ` are
  two codes; the parser reports such pairs), in list order. The `Typ` column
  (`SU`, `Pr`, `Ue`, `S`, `WF`, `SU/Ue`, ...) is not output, but it hints at
  the course types when the handbook has no entry.
- Clean each name: drop a leading repetition of its own code, also with spaces
  or glued on (`101xyz Beispielfach`, `mMOD6/2Beispielfach`), but not when the
  code is just the start of a word (`TEC Technik`, `ABC ABC-Technik`). Drop
  trailing course-type words (`Praktikum`, `Pr`, `Übung`, `Übungen`, `Uebung`,
  `Seminar`, `Vorlesung`), unless an adjective makes them the name
  (`Experimentelles Praktikum`). Type words in the middle stay
  (`Beispielfach Praktikum Nachzügler`).
- Pick the name per code: if all cleaned names agree, use it; otherwise the
  name of the one row whose `Typ` contains `SU`.
- A name that starts with a different code (`mMOD5/2` named `mMOD5/2B
  Beispielfach B`): drop that other code (`Beispielfach B`).
- A name that is empty after cleaning (`MODX Pr MODX Praktikum`): keep the
  name as printed (`MODX Praktikum`).
- Codes are unique in the output: one entry per code, never two entries with
  the same code (the validator rejects them). Don't offer that as an option
  when asking about a name.
- Keep the wording as printed, including abbreviations
  (`Grundl. d. Beispielfachs u. Anw.`) and typos. The list is the faculty's own
  naming; you may point out obvious typos in the chat summary.

## Step 2: make the handbook readable

Handbooks are long (80-260 pages) and laid out very differently: codes in
headings (`MOD1 - Beispielfach 1`), codes in parentheses
(`Beispielfach (B2)`), codes in a field (`Modul-Nr.`), or no codes at
all; fields as label/value columns or as tables. Don't expect one pattern;
find the pattern of the handbook in front of you.

```text
python3 <skill-dir>/degreeinformation/handbook_digest.py <handbook.pdf> --out <drafts-dir>/<major>.digest.txt
```

It removes running headers/footers, literature lists, staff and contact
fields, compresses the layout, marks pages (`=== p.N ===`) and prints the
table of contents. The digest is still long; read it module by module with
`grep -n` (for a module name or code, or for field labels like `SWS`,
`Prüfung`, `Leistungsnachweis`, `Lehrform`) and view line ranges, instead of
reading it front to back. In table layouts a field next to a literature list
can be cut short; when a field looks incomplete, read the original page:
`pdftotext -layout -f N -l N <handbook.pdf> -`.

Build a module index from the table of contents and the section headings:
code (if any), name, part structure (e.g. module `15` with parts `15a ABC` and
`15b XYZ`, or `G6` with `G6.1` / `G6.2`, or `B1` with `B1a` / `B1b`) and the
digest lines where each module starts. Keep it in the drafts folder.

## Step 3: match list entries to handbook modules

Go through the list and find each code's module, the most specific one
available (a course part rather than its parent module):

1. **Same code**: the handbook shows the list's code (ignoring case and
   spaces), or the list writes the handbook code with extra marks that
   timetables use. Common marks: a leading lowercase letter (`mMOD1` =
   `MOD1`, `mMOD3/1` = `MOD3/1`), a parallel-group suffix (`MOD/A`, `MOD/B` =
   groups of `MOD`), a late-starter suffix (`MOD2-NZ`), or a cohort added to
   the name (`Beispielfach 1 <Kohorte>`). What remains after removing the
   mark must equal the handbook code exactly; `mMOD2/2` is `MOD2/2`, never
   `MOD2`. Each variant gets the module's data, limited by its course types
   (see `sws`); its name stays the list's. A letter suffix can also mean a
   part the handbook describes separately (`MOD/A`, `MOD/B` = exam parts "Teil
   A" and "Teil B" of `MOD`): then describe that part.
   A handbook statement of equivalence counts as the same code: fields like
   `Verwendbarkeit: Inhaltsgleich zu <anderer Studiengang> (XYZ4)` mean
   list code `XYZ4` gets this module, even if the names
   differ. `grep -n -A2 Verwendbarkeit` in the digest finds them.
2. **Same subject by name**, when the handbook module has no code (some
   handbooks have none) or the list code looks like no handbook code: equal
   after normalising case, punctuation, hyphens and `u.`/`und`; or the list
   name is an evident short form of exactly one module name (`Grundl. d.
   Beispielfachs` ↔ `Grundlagen des Beispielfachs`); or it adds a
   cohort/course-form word (`… Nachzügler`, `… (Block)`). Several list codes
   may share one module.
   The code takes precedence: a list code that matches a handbook code by
   rule 1 is never re-matched by name. A list code with no handbook code
   (a numbered elective `101XYZ`, another programme's `XYZ1`) takes the
   module whose name is **equal** after normalising, even if that module has
   a different code (`101XYZ Beispielfach` → `MOD7 Beispielfach`). Names
   that are only similar (an added number, group letter, cohort or
   course-form word: `Beispielfach 1`, `Beispielfach A`, `Beispielfach
   <Kohorte>`, `Beispielfach Online`) do **not**
   match such a coded module. These are decided rules, not questions.
3. Otherwise the code has no handbook module.

A list entry that names a whole module the handbook only describes in parts
matches the whole: sum the parts' SWS and describe the whole module.

Write the result as a match table (code, list name, handbook module or
"—", how it matched) and print it; the chat summary reports its counts.
A match that you can't make with confidence (two candidate modules, or a
plausible but uncertain pairing) is a question, not a guess.

## Step 4: fill the fields

Work in batches of about 10-15 entries: read the module, write the entries,
append them to `<drafts-dir>/<major>.entries.jsonl` (one JSON object per
line, in output order), then continue. Long runs stay manageable, and
nothing is lost if you need to re-read a module. For a two-language handbook
pair, read the English module next to the German one.

### `code`

The list's code, exactly as printed. For handbook-only modules, the handbook
code exactly as written (`MOD1`, `WPM1/1`, `AB-2`).

### `name`

- `de`: the cleaned list name; for handbook-only modules the module name
  without number and code (section heading beats table of contents).
- `en`: from an English handbook when there is one; otherwise translate,
  using the established terminology of the field (the English term the
  field actually uses, not a word-by-word rendering; "Einführung in X" →
  "Introduction to X", "Grundlagen der X" → "Fundamentals of X"). A name
  that is already English stays the same in both.

### `sws`

From the handbook module only; never from general knowledge. Map course
types to the three categories:

| Handbook says | Category |
|---|---|
| Übung, Ü, Ue, Tutorium (if it carries SWS) | `exercise` |
| Praktikum, Pr, P, Labor | `laboratory` |
| Vorlesung, V, seminaristischer Unterricht, SU, Seminar, S, Projekt, anything else | `lecture` |

- Use the numbers as stated (`4 SWS Vorlesung, 2 SWS Übung` → 4 / 2 / 0;
  decimals like `1,5` → `1.5`).
- **If the handbook doesn't say which category the SWS belong to, they go to
  `lecture`**: a total with types but no split (`Umfang: 8 SWS`,
  `seminaristischer Unterricht und Übung`), a combined type (`6 SWS
  Vorlesung/Übung`, `Pr/Sem 4`), or a total without types. Use a split
  stated elsewhere in the same module, though (e.g. "begleitendes Seminar
  (2 SWS)" next to `Pr/Sem 4` → 2 lecture, 2 laboratory).
- **The list's `Typ` column says which course types a code stands for.**
  Timetables often give one module several codes, e.g. `MOD/A` and `MOD/B`
  (`SU`: two lecture groups) and `MOD` (`Pr`: the lab), or `MOD2-NZ` (`Ue`
  only). Keep only the module's SWS in the categories the code's rows name
  (`SU`, `S`, `V`, `WF` → lecture, `Ue` → exercise, `Pr` → laboratory; combined
  types like `SU/Ue` name both). A type not in this mapping doesn't restrict
  anything: keep the module's values for that code. If the restriction would
  leave all three at `0`, keep the module's values. Otherwise one module's hours
  would be counted once per code. Start the description of a lab-only code with
  a short note ("Praktikum zu diesem Modul." / "Lab of this module.").
- Categories without SWS are `0`. No handbook module, or no SWS in it: all
  three `0`.
- A handbook that gives only contact hours, never SWS: ask once per handbook
  whether and how to convert (quote an example, propose the factor the
  handbook implies, e.g. `Präsenzstunden 48 Std.` ÷ 12 weeks = 4 SWS).

### `description`

Written by you, not copied: at most **100 words** per language (aim for
40-80), one plain paragraph without lists, Markdown or line breaks. It tells
a student what the subject teaches them: the main topics and what they will
be able to do afterwards. Neutral voice without du/Sie ("Das Modul
vermittelt …", "Studierende lernen …" / "Students learn …").

- With a handbook module: base it on learning goals and contents
  (Lernziele, Qualifikationsziele, Inhalte, Lehrinhalte). Leave out
  administration (credits, lecturers, exam, prerequisites, literature) and
  boilerplate repeated across many modules ("In den Modulen des ersten
  Studienabschnitts setzen sich die Studierenden kritisch …").
- Without one: store only the code and its name. The schema still requires
  a description, so write "Keine Angabe" / "Not specified"; don't write a
  text from general knowledge.
- German and English say the same thing, each written naturally rather than
  word by word.

### `test`

The exam form as the handbook states it, as a short phrase in each language:
type, duration, weighting and alternatives, e.g. `schrP 90` →
"Schriftliche Prüfung (90 Minuten)" / "Written exam (90 minutes)";
`SchrP 90 (50%) und Ref (50%)` → "Schriftliche Prüfung, 90 Minuten (50 %),
und Referat (50 %)" / "Written exam, 90 minutes (50%), and presentation
(50%)". Expand abbreviations using the handbook's own legend when it has one;
a short admission requirement may follow in parentheses. Modules with parts
examined separately: name each part ("Teil A: …; Teil B: …").
Nothing stated, or no handbook module: "Keine Angabe" / "Not specified".
Don't infer the exam from the list's `Typ` column or general knowledge.

## Step 5: assemble, validate, summarise

```text
python3 -c "import json,sys; print(json.dumps({'subjects': [json.loads(l) for l in open(sys.argv[1], encoding='utf-8') if l.strip()]}, ensure_ascii=False, indent=2))" <drafts-dir>/<major>.entries.jsonl > <drafts-dir>/degreeinformation_<major>.json
python3 <skill-dir>/scripts/validate.py degreeinformation <drafts-dir>/degreeinformation_<major>.json --list <drafts-dir>/list_<faculty>.json
```

The validator also checks unique codes, the 100-word limit and single-line plain
text. In the chat summary per file: the list (faculty, semester, `Stand`) and
handbook (programme, edition) used; entry counts (total, matched, list-only,
handbook-only); handbook modules skipped for lack of a code (by name); how many
entries used the SWS lecture fallback, were limited by their course types, or
have no SWS; how many have no stated exam; which language you translated. If the
request included timetables, list timetable codes missing from the file (don't
invent entries for them).

## Ask the user (collect everything into one message, see SKILL.md)

- the list parser's ISSUES that aren't `INFO`: rows of one code naming
  different subjects without exactly one `SU` row; a `COMPLETENESS` issue
  you can't resolve from the PDF.
- a match you can't make with confidence despite the rules of step 3 (e.g.
  two handbook modules with the same name).
- the same handbook code with different names, or, in a two-language pair, a
  module present in only one language.
- a handbook with contact hours but no SWS (see `sws`).
- the pairing questions under "Inputs".

## Finding a handbook online

Use this when the user names a programme but attached no handbook.

- The user must name the programme; if the name matches several (Bachelor
  and Master), ask which.
- Open `https://www.th-nuernberg.de/studiengaenge/` (German) and
  `https://www.th-nuernberg.de/en/all-degree-programmes/` (English) and
  follow the links to the programme page. These overview pages load their
  list with JavaScript and may show only "Loading ..."; then web-search e.g.
  `TH Nürnberg Bachelor <programme name>` and accept only a programme page
  on th-nuernberg.de (`https://www.th-nuernberg.de/studiengang/<slug>/`),
  not a PDF found directly, so you see which handbook the programme links
  now. The language switcher (`EN`) leads to the English page.
- Use the link "Modulhandbuch" / "Module handbook" (usually under "Wichtige
  Dokumente" / "Dokumente"). Several linked: take the latest edition
  ("Ausgabe", "gültig ab", version date); ask if unclear.
- Fetch it with `web_fetch` (PDF text extraction on). The sandbox can't
  reach th-nuernberg.de, so the digest script doesn't apply: read the
  fetched text module by module and use a generous token limit, since a
  full handbook is 80+ pages. If you could only read part of it, say up to
  which module in the chat summary; the modules you didn't see count as
  missing.
