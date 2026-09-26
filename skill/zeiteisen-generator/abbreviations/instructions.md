You are extracting subject codes and their German and English names into
`schema.json`. There are two sources:

- **Source A: the official abbreviation list** (Abkürzungsverzeichnis) of a
  faculty. Use it whenever the user provides it. It is the authoritative
  list of the codes used in that faculty's timetables for one semester,
  including codes a module handbook doesn't contain (late-starter courses,
  course parts, codes of other programmes, numbered electives).
- **Source B: module handbooks** (Modulhandbuch / module handbook), the
  fallback when no official list is provided. Don't search the web for an
  official list; only use one the user supplies.

If the user provides both for the same faculty, use the list and don't mix
names from the handbook into it.

## Source A: official abbreviation list

Recognise it by a title like "Abkürzungen", a table with the columns
`Fachkürzel | Typ | Fach`, a semester and date line (e.g. `wi26/27 Stand
15.09.2026`) and a footer naming the faculty (`Fakultät: <faculty>`). Other
faculties may format their list differently; if the columns can't be
identified with confidence, ask.

1. Run the draft parser (if you can't run Python, read the table by hand as
   described in `no-shell.md`, section 3, in the skill's root folder):

   ```
   python3 <skill-dir>/abbreviations/parse_list.py <list.pdf> --outdir <drafts-dir>
   ```

   It rebuilds the rows (including names wrapped onto a second line), groups
   them by code, applies the rules below, prints each code with its chosen
   name and source rows, and lists ISSUES (exit code 2 = something needs a
   decision; `INFO` lines are already decided). It writes
   `abbreviations_<faculty>_draft.json` with empty `en` fields. Spot-check
   the output against the PDF, then fill in `en` (see Languages) and save
   the final file as `abbreviations_<faculty>.json`.
2. One file per faculty list. Two lists of the same faculty (e.g. different
   semesters or `Stand` dates): ask which to use. Mention the list's
   semester and `Stand` in the chat summary.

Rules (already decided, don't ask):

- One entry per code, spelled exactly as printed (`016efi` and `016EFI`
  would be two codes; the parser reports such pairs), in list order.
- A code often has several rows, one per course type (`SU`, `Pr`, `Ue`,
  `S`, `WF`, `SU/Ue`, ...). The `Typ` column is not part of the output.
- Clean each name: drop a leading repetition of its own code, also with
  spaces or glued on (`007efi Reliability Engineering`, `103 efi Skriptsprache
  Python`, `mINF6/2Usability Engineering`), and drop trailing course-type
  words (`Praktikum`, `Pr`, `Übung`, `Übungen`, `Uebung`, `Seminar`,
  `Vorlesung`), because the kind is already stored in the timetable.
  Type words in the middle stay (`Aufbau- und Verbindungstechnik Praktikum
  Nachzügler`).
- Pick the name per code: if all cleaned names agree, use it; otherwise use
  the name from the one row whose `Typ` contains `SU` (the lecture) and
  ignore small differences in the other rows.
- Keep the wording as printed, including abbreviations (`Innovations u.
  Patentmanag.`) and apparent typos. Don't expand or correct them; you may
  point out obvious typos in the chat summary.

Ask the user (see SKILL.md) when:

- the rows of one code name different subjects and there isn't exactly one
  `SU` row to prefer (quote all rows).
- a name is empty after cleaning (e.g. a row that only says `<code>
  Praktikum`).
- a name starts with a different code (e.g. code `ABC5/2` with the name
  `ABC5/2B Some Subject B`): it is unclear which code the row belongs to.

## Source B: module handbooks

The structure of module handbooks is not guaranteed; it differs between
faculties and editions. The rules below describe what to look for. If you
can't reliably tell which text is a module code and which is its name, ask
the user (see SKILL.md). A handbook lists modules, not every code that
appears in timetables, so some timetable codes may be missing; mention that
when relevant.

### B1. Get the handbook(s)

**PDFs attached:** use them, and decide which ones belong together.

- Identify each PDF's major from its title page (e.g. "Bachelor
  <Programme name> (<short code>)") and its language.
- Same major, different languages -> **one** JSON file. Take `de` from the
  German PDF and `en` from the English PDF. Don't translate in this case.
- Different majors -> one JSON file per major.
- Ask the user if two PDFs are the same major in the same language (e.g. two
  editions), or if you can't tell whether two PDFs are the same major.

**Nothing attached:** find the handbook online.

- The user must name the major. If they didn't, ask. If the name matches
  more than one programme (e.g. both a Bachelor and a Master), ask which one.
- Open `https://www.th-nuernberg.de/studiengaenge/` (German) and
  `https://www.th-nuernberg.de/en/all-degree-programmes/` (English) and
  follow the links to the major's programme page. Only fetch URLs that appear
  on the pages; don't construct them.
- These overview pages load their programme list with JavaScript, so a fetch
  may show only filters and "Loading ...". In that case, find the programme
  page with a web search, e.g. `TH Nürnberg Bachelor <programme name>`.
  Accept only a programme page on th-nuernberg.de (URLs look like
  `https://www.th-nuernberg.de/studiengang/<programme-slug>/`),
  not a PDF found directly by the search, so that you see which handbook the
  programme currently links. The programme page's language switcher (`EN`)
  leads to the English programme page.
- On the programme page(s), use the link named "Modulhandbuch" /
  "Module handbook" (usually under "Wichtige Dokumente" / "Dokumente").
- If several handbooks are linked, pick the latest one (highest edition /
  "Ausgabe", latest "gültig ab" / valid-from date, or latest version date).
  Ask if it's unclear which one is the latest.
- Fetch the PDF with `web_fetch` (with PDF text extraction enabled). A token
  limit around 12,000 is enough for the table of contents (pages 2-3) and
  the first module sections; a full handbook is ~80 pages. If you only saw
  part of the body, say in the chat summary up to which module the section
  headings were cross-checked.
- The German and English pages often link to the same handbook (commonly
  German-only). In that case, treat it as a single-language handbook (see
  step 3).

### B2. Extract codes and names

Handbook structure differs between faculties and programmes (tables of
contents, module tables, one page per module, codes in headings or in a
"Modulkürzel" field). Find the pattern of the handbook in front of you
rather than expecting a particular one; the examples below are
placeholders.

- A good index is usually the table of contents, where modules appear as
  `<no.> <CODE> - <Name>` (e.g. `10 MOD1 - Modulname 1`), with elective
  sub-modules listed as `<CODE> <Name>` (e.g. `WPM1/1 Wahlpflichtmodul
  Eins`). Cross-check against the module section headings in the
  body. If there's no table of contents, use the section headings or a
  "Modulkürzel" / "module code" field.
- `code`: exactly as written, including `/`, `-` and digits: `"MOD1"`,
  `"WPM1/1"`, `"AB-2"`.
- `de` / `en`: the module name without number and code: `"Modulname 1"`.
  If the table of contents and the section heading differ, use the section
  heading.
- One entry per code, in document order.

Already decided, don't ask:

- Entries without a code are skipped, e.g. "Bachelorarbeit", "Praxisteil",
  "Allgemeinwissenschaftliches Wahlpflichtmodul". So are group headings such
  as "Fachwissenschaftliche Wahlpflichtmodule der Gruppe 1" or any module
  group title that carries no code. Their coded sub-modules are kept.
- A code listed twice with the same name is kept once.

Ask the user (see SKILL.md) when:

- the same code appears with different names.
- in a two-language pair, a code exists in only one of the two PDFs.

## Languages (both sources)

- Both languages from handbook PDFs: see B1.
- The official list is German-only: translate every `en`.
- Single-language source: fill the other language by translating. Use
  established academic terminology of the field, e.g. "Ingenieurmathematik 1"
  -> "Engineering Mathematics 1", "Kostenrechnung" -> "Cost Accounting",
  "Entwicklungspsychologie" -> "Developmental Psychology", "Baustatik" ->
  "Structural Analysis".
- A name that is already in the target language stays unchanged. English
  module titles in an otherwise German handbook (e.g. "Technical and
  Business English", "Data Science Lab") get the same text in `de` and
  `en`. The same applies in reverse for German names in
  an English handbook.
- Mention in the chat summary which language was translated by you.

## Cross-check with timetables

If the same request includes timetables, check that every timetable `name`
has a matching `code` in the abbreviations and list any that don't in the
chat summary (don't invent entries for them).
