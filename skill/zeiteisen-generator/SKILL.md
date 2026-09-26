---
name: "zeiteisen-generator"
description: "Extract structured JSON data (timetables as .timetable files) for a university timetable app (TH Nürnberg / Ohm) from four kinds of sources: timetable PDFs (Stundenplan of any programme or faculty, e.g. codes like BEI3, BW2, AR5), official faculty abbreviation lists (Abkürzungen / Abkürzungsverzeichnis: Fachkürzel, Typ, Fach) and module handbooks (Modulhandbuch / module handbook), both for subject degree information with German and English names, the semester dates pages (Termine im Überblick, Wintersemester/Sommersemester, lecture-free days) and the campus location pages (Anfahrt / Standorte: building codes like WE, KA, BB). Use this skill whenever the user attaches a timetable, abbreviation list or module handbook PDF, even without any text, or asks for subject degree information of a major, semester dates, or building locations, or links a th-nuernberg.de page for any of these. Also use it when several of these are requested at once."
---

# Zeiteisen Generator

This skill produces JSON data files for a timetable app. Timetables are saved with the extension `.timetable` (the content is still plain JSON); all other outputs are `.json` files. There are four tasks, each in its own folder:

| Folder | Input | Output |
|---|---|---|
| `timetable/` | Timetable PDF (Stundenplan) | Array of subjects, each with a `repeat` block (weekly day/time or individual dates, plus professor and room), group, kind and notes |
| `degreeinformation/` | Official abbreviation list PDF (preferred), else module handbook PDF or the major's name | Subject codes with German and English names |
| `dates/` | Semester dates webpage, or nothing | Year, lecture period and events |
| `locations/` | Campus locations webpage, or nothing | Building codes with street, Maps URL and site URL |

Each folder contains:

- `instructions.md`: how to find, read and convert the input. Read it before starting that task.
- `schema.json`: the JSON schema the output must match exactly. **Never modify a schema.**

Scripts:

- `timetable/parse.py` drafts a `.timetable` from a timetable PDF and lists anything that needs a decision (see `timetable/instructions.md`, step 0).
- `degreeinformation/parse_list.py` drafts degree information from an official abbreviation list PDF (see `degreeinformation/instructions.md`, Source A).
- `scripts/validate.py` checks an output file against a task's schema. It needs `jsonschema` (`pip install jsonschema --break-system-packages` if it reports it missing).

**No shell or Python?** If you can't run commands (no bash / code-execution tool, or Python fails), read `no-shell.md` before starting. It covers reading PDFs without rendering, manual count checks, checking output against the schema by hand, and delivering files in chat. Everything else in this skill still applies.

## The most important rule: ask instead of guessing

The app consumes these files automatically, so a wrong value is worse than a missing file. If anything does not fit the schema, or you are not fully certain about a value, **do not output any file**. Instead, tell the user exactly what is unclear (quote the source text, e.g. a cell reading `XYZ:Sem:2.1`, whose kind `Sem` is not allowed by the schema). Ask how to proceed, and continue once they answer.

When a request covers several tasks or files, collect every open question first and ask them all in one message. Deliver the files only after everything is resolved. To make that one message complete, finish every task as far as possible first (extract, build, validate) and keep the results as drafts; then the files are ready the moment the user answers, and the answers only touch the affected entries. In the question, quote the source text, say what the rules would produce, and offer the concrete options.

The task instructions list rules that are already decided (e.g. which entries to skip). Applying such a rule is not uncertainty.

Examples of things that require asking:

- a value that isn't in a schema `enum`
- a required field you can't fill from the source
- text you can't read with confidence
- an ambiguous major
- a page whose layout no longer matches what the instructions describe

## Works for every programme and faculty

Nothing in this skill is tied to one study programme; codes, names and rooms in the instructions are placeholders or clearly marked examples. Faculties format their documents differently (timetable grids, cell syntax, handbook structure), and formats change between semesters. The schemas are the fixed target; the inputs are not. When an input doesn't look like what the instructions describe, work out its structure from the document itself, map it to the schema where the meaning is unambiguous, and ask the user about the rest instead of forcing it into the expected pattern.

## Workflow

1. **Identify the tasks.** Look at what the user attached and asked for:
   - A PDF with a weekday grid, time rows and a header like `Winter26/27 … <code>` is a **timetable**. Layouts can differ between faculties; `timetable/instructions.md` says how to handle a layout that doesn't match the reference.
   - A PDF titled `Abkürzungen` with a table `Fachkürzel | Typ | Fach` is an **official abbreviation list** (→ `degree information`, preferred source).
   - A PDF titled `Modulhandbuch` / `Module handbook` with module descriptions is a **module handbook** (→ `degree information`, used when no official list is provided).
   - "dates", "Termine", "semester schedule", or a link under `…/termine-im-ueberblick/` or `…/semester-schedule/` is a **dates** task.
   - "locations", "buildings", "Standorte", or a link under `…/anfahrt/` or `…/directions/` is a **locations** task.
   - "degree information / subjects / modules for major X" with no PDF is a **degree information** task via the website.
   
   If the user asks for a timetable but attached none, say so and stop that task. There is no fallback for timetables.
   
   If two attachments are the same document, or two results would get the same file name (e.g. two timetables that are both `ABC3`, winter 2026), ask the user before continuing.
2. **Read the instructions.** For each task, read `<task>/instructions.md` and `<task>/schema.json`. For PDFs, also follow the file-reading / pdf-reading skills for how to open them.
   Web pages: `web_fetch` only opens URLs that appeared earlier in the same turn, so always fetch the start page first and then follow its links; never reuse a URL from memory or an earlier conversation turn without re-fetching the page that links to it. Even the start URLs written in the instructions count as "not seen": if a fetch is refused, run a `web_search` for the page (e.g. `TH Nürnberg Anfahrt Standorte`) and fetch the URL from the results. th-nuernberg.de pages begin with ~10k tokens of navigation menus; the content is at the end, so budget for it (a full locations + dates + handbook run fetches ~15 pages). The bash sandbox cannot reach th-nuernberg.de.
3. **Extract.** Follow the task instructions (without a shell: `no-shell.md`) and write each result to a drafts folder (e.g. `/home/claude/drafts/<filename>`), using the file names and extensions below (`.timetable` for timetables, `.json` for everything else). Keep them out of `/mnt/user-data/outputs/` until nothing is open, so the user never sees a half-finished set.
4. **Validate.** Run `python3 <skill-dir>/scripts/validate.py <task> <file>` on every file (without a shell: check by hand as in `no-shell.md`, section 4). On failure, fix your output. You may never fix the schema. If the output cannot be made valid without inventing data, treat it as an open question (see above) and delete the file. If the script reports a SCHEMA ERROR, tell the user the schema file is broken and deliver nothing for that task.
5. **Deliver.** Once every question is answered, apply the answers, re-validate, copy the files to `/mnt/user-data/outputs/` and present all valid files together (without a shell or file system: see `no-shell.md`, section 5). In chat, give a short summary per file (e.g. "ABC3, winter 2026: 58 subjects"). The code and semester go in this summary and the file name, since the timetable file itself no longer contains them.

## Output format

- Each file contains exactly one JSON value matching the schema: an array for timetables, an object for the other tasks. No Markdown fences, no comments and no keys the schema doesn't define. A `.timetable` file is still plain JSON; only the extension differs.
- Omit optional properties you have no value for, rather than sending empty strings, unless the task instructions say otherwise.
- Everything meant for the user (summaries, questions, warnings) goes in the chat, never into the JSON.
- File names:
  - `timetable_<code>_<half><year>.timetable`, e.g. `timetable_ABC3_winter2026.timetable`. `<code>`, `<half>` and `<year>` come from the PDF header (see `timetable/instructions.md`, rule 1). Use one file per timetable PDF. Never use `.json` for a timetable.
  - From an official abbreviation list: `degreeinformation_<faculty>.json` (faculty as printed in the list's footer, e.g. `degreeinformation_xyz.json`), one file per list.
  - From a module handbook: `degreeinformation_<major>.json`, e.g. `degreeinformation_B-ABC.json`. Use the major's short code from the handbook, or a short slug of its name. Use one file per major.
  - `dates.json`.
  - `locations.json`.
