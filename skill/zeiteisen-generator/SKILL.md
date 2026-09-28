---
name: "zeiteisen-generator"
description: "Extract structured JSON data for a university timetable app (TH Nürnberg / Ohm) from: timetable PDFs (Stundenplan of any programme or faculty, codes like ABC3, saved as .timetable files); official faculty abbreviation lists (Abkürzungen: Fachkürzel, Typ, Fach) combined with module handbooks (Modulhandbuch) and study plans (Studienplan / Studienverlaufsplan with LP) into .degree files (subject codes, German and English names, SWS, LP / ECTS credits, descriptions, exam forms); semester dates pages (Termine im Überblick, Wintersemester/Sommersemester, lecture-free days); and campus location pages (Anfahrt / Standorte: building codes like WE, KA, BB). Use this skill whenever the user attaches a timetable, abbreviation list, module handbook or study plan PDF, even without any text, or asks for subjects, modules, SWS, credits, exams or degree information of a major, semester dates, or building locations, or links a th-nuernberg.de page for any of these. Also use it when several of these are requested at once."
---

# Zeiteisen Generator

This skill produces JSON data files for a timetable app. Timetables are saved
with the extension `.timetable`, degree files with `.degree` (the content is
still plain JSON); all other outputs are `.json` files. There are four tasks, each in its own folder:

| Folder | Input | Output |
|---|---|---|
| `timetable/` | Timetable PDF (Stundenplan) | Array of subjects, each with a `repeat` block (weekly day/time or individual dates, plus professor and room), group, kind and notes |
| `degree/` | Official abbreviation list PDF, **and** the programme's module handbook PDF **and** study plan (Studienplan) PDF (or the programme's name, to find both online) | Per subject: code, German and English name, SWS per course type, credit points (LP / ECTS), description, exam form |
| `dates/` | Semester dates webpage, or nothing | Year, lecture period and events |
| `locations/` | Campus locations webpage, or nothing | Building codes with street, Maps URL and site URL |

Each folder contains:

- `instructions.md`: how to find, read and convert the input. Read it before
  starting that task.
- `schema.json`: the JSON schema the output must match exactly.
  **Never modify a schema.**

Scripts:

- `timetable/parse.py` drafts a `.timetable` from a timetable PDF and lists
  anything that needs a decision (see `timetable/instructions.md`, step 0).
- `degree/parse_list.py` reads codes and German names from an
  official abbreviation list PDF (see `degree/instructions.md`, step
  1).
- `degree/parse_studyplan.py` reads the credit points (LP) per
  module from a study plan PDF and cross-checks them against its `Summe`
  lines (step 1b).
- `degree/handbook_digest.py` shrinks a module handbook PDF to a
  compact digest with its table of contents (step 2).
- `scripts/validate.py` checks an output file against a task's schema. It needs
  `jsonschema` (`pip install jsonschema --break-system-packages` if it reports
  it missing).

**Editing the skill itself?** Read `DESIGN.md` first; it records the design
decisions and an edit checklist. It is not needed for running a task.

**No shell or Python?** If you can't run commands (no bash / code-execution
tool, or Python fails), read `no-shell.md` before starting. It covers reading
PDFs without rendering, manual count checks, checking output against the schema
by hand, and delivering files in chat. Everything else in this skill still
applies.

## The most important rule: ask instead of guessing

The app consumes these files automatically, so a wrong value is worse than a
missing file. If anything does not fit the schema, or you are not fully certain
about a value, **do not output any file**. Instead, tell the user exactly what
is unclear (quote the source text, e.g. a cell reading `XYZ:Sem:2.1`, whose kind
`Sem` is not allowed by the schema). Ask how to proceed, and continue once they
answer.

When a request covers several tasks or files, collect every open question first
and ask them all in one message. Deliver the files only after everything is
resolved. To make that one message complete, finish every task as far as
possible first (extract, build, validate) and keep the results as drafts; then
the files are ready the moment the user answers, and the answers only touch the
affected entries. In the question, quote the source text, say what the rules
would produce, and offer the concrete options.

The task instructions list rules that are already decided (e.g. which entries to
skip). Applying such a rule is not uncertainty.

Examples of things that require asking:

- a value that isn't in a schema `enum`
- a required field you can't fill from the source
- text you can't read with confidence
- an ambiguous major
- a timetable's `degreeProgram` (the name, without `.degree`, of the degree
  file its subjects belong to), unless the user already gave it or the same
  request builds that degree file (`timetable/instructions.md`, rule 10);
  otherwise it is always a question for a timetable, never guessed
- a page whose layout no longer matches what the instructions describe

## Works for every programme and faculty

Nothing in this skill is tied to one study programme; codes, names and rooms in
the instructions are placeholders or clearly marked examples. Faculties format
their documents differently (timetable grids, cell syntax, handbook structure),
and formats change between semesters. The schemas are the fixed target; the
inputs are not. When an input doesn't look like what the instructions describe,
work out its structure from the document itself, map it to the schema where the
meaning is unambiguous, and ask the user about the rest instead of forcing it
into the expected pattern.

## Workflow

1. **Identify the tasks.** Look at what the user attached and asked for:
   - A PDF with a weekday grid, time rows and a header like
     `Winter26/27 … <code>` is a **timetable**. Layouts can differ between
     faculties; `timetable/instructions.md` says how to handle a layout that
     doesn't match the reference.
   - A PDF titled `Abkürzungen` with a table `Fachkürzel | Typ | Fach` is an
     **official abbreviation list**, and a PDF titled `Modulhandbuch` /
     `Module handbook` with module descriptions is a **module handbook**, and
     a PDF whose title page says `Studienplan`, with a table
     `Studienverlaufsplan` that has an `LP` column, is a **study plan** (its
     running page header may still say "Modulhandbuch"; the title page
     decides). Don't mix up `Studienplan` (study plan) and `Stundenplan`
     (timetable). All three feed one **degree** task; if one is
     missing, `degree/instructions.md` ("Inputs") says how to get
     it.
   - "dates", "Termine", "semester schedule", or a link under
     `…/termine-im-ueberblick/` or `…/semester-schedule/` is a **dates** task.
   - "locations", "buildings", "Standorte", or a link under `…/anfahrt/` or
     `…/directions/` is a **locations** task.
   - "subjects / modules / degree information for major X" with no PDF is a
     **degree** task: the handbook and study plan can come from the
     website, the list must come from the user.

   If the user asks for a timetable but attached none, say so and stop that
   task. There is no fallback for timetables.

   If two attachments are the same document, or two results would get the same
   file name (e.g. two timetables that are both `ABC3`, winter 2026; names
   differing only in upper / lower case count as the same), ask the user before
   continuing.
2. **Read the instructions.** For each task, read `<task>/instructions.md` and
   `<task>/schema.json`. For PDFs, also follow the file-reading / pdf-reading
   skills for how to open them. Web pages: `web_fetch` only opens URLs that
   appeared earlier in the same turn, so always fetch the start page first and
   then follow its links; never reuse a URL from memory or an earlier
   conversation turn without re-fetching the page that links to it. Even the
   start URLs written in the instructions count as "not seen": if a fetch is
   refused, run a `web_search` for the page (e.g.
   `TH Nürnberg Anfahrt Standorte`) and fetch the URL from the results.
   th-nuernberg.de pages begin with ~10k tokens of navigation menus; the content
   is at the end, so budget for it (a full locations + dates + online-handbook
   run fetches ~15 pages). The bash sandbox cannot reach th-nuernberg.de.
3. **Extract.** Follow the task instructions (without a shell: `no-shell.md`)
   and write each result to a drafts folder (e.g.
   `/home/claude/drafts/<filename>`), using the file names and extensions below
   (`.timetable` for timetables, `.degree` for degree files, `.json` for
   everything else). Keep them out of
   `/mnt/user-data/outputs/` until nothing is open, so the user never sees a
   half-finished set.
4. **Validate.** Run `python3 <skill-dir>/scripts/validate.py <task> <file>` on
   every file (for degree add `--list <list_<faculty>.json>`: every
   list code must be in the file, this matters most; and `--plan
   <plan_<major>.json>`: every `lp` must come from the study plan) (without a shell: check by
   hand as in `no-shell.md`, section 4). On failure, fix your output. You may
   never fix the schema. If the output cannot be made valid without inventing
   data, treat it as an open question (see above) and delete the file. If the
   script reports a SCHEMA ERROR, tell the user the schema file is broken and
   deliver nothing for that task.
5. **Deliver.** Once every question is answered, apply the answers, re-validate,
   copy the files to `/mnt/user-data/outputs/` and present all valid files
   together (without a shell or file system: see `no-shell.md`, section 5). In
   chat, give a short summary per file (e.g. "ABC3, winter 2026: 58 subjects";
   for a degree file the counts listed in
   `degree/instructions.md`, step 5). The code and semester go in
   this summary and the file name, since the timetable file itself no longer
   contains them; for a timetable also name its `degreeProgram` (or that it
   has none).

## Output format

- Each file contains exactly one JSON value matching the schema: an array for
  timetables, an object for the other tasks. No Markdown fences, no comments and
  no keys the schema doesn't define. A `.timetable` or `.degree` file is still
  plain JSON; only the extension differs.
- Omit optional properties you have no value for, rather than sending empty
  strings, unless the task instructions say otherwise.
- Everything meant for the user (summaries, questions, warnings) goes in the
  chat, never into the JSON.
- File names:
  - `timetable_<code>_<half><year>.timetable`, e.g.
    `timetable_ABC3_winter2026.timetable`. `<code>`, `<half>` and `<year>` come
    from the PDF header (see `timetable/instructions.md`, rule 1). Use one file
    per timetable PDF. Never use `.json` for a timetable.
  - `<major>.degree`, e.g. `B-ABC.degree`, one file per programme
    (handbook). Use the major's short code from the handbook, or a short slug
    of its name. The name without `.degree` is what a timetable's
    `degreeProgram` names, so no prefix or suffix. Never use `.json` for a
    degree file.
  - `dates.json`.
  - `locations.json`.
  - Every file name must save on Windows, macOS / iOS, Linux and Android, and a
    timetable's or degree file's name (without its extension) becomes its
    name in the app. So
    a name never contains `< > : " / \ | ? *` or control characters: replace
    each run of them in a code or slug with `-` (a code printed `ABC3/4` gives
    `timetable_ABC3-4_winter2026.timetable`) and mention the replacement in the
    chat summary. It never ends with a dot or a space, and its part before the
    first dot is never `CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9` or
    `LPT1`-`LPT9` (any case). `validate.py` checks the name too.
