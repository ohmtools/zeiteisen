# Design decisions: read this before editing the skill

This file is for whoever changes the skill (a person or Claude), not for
running a task. It records why the skill is built the way it is, so that
edits keep it consistent. When a new decision is made, add it here.

## 1. Purpose and consequences

The output is consumed **automatically** by a timetable app. Nobody reviews a
file before the app uses it. Everything else follows from that:

- **A wrong value is worse than a missing one.** The skill never guesses. If
  a value is uncertain or doesn't fit the schema, it asks the user
  (SKILL.md, "ask instead of guessing").
- **Questions are collected.** All open points of a run go into one message,
  after all tasks have been drafted as far as possible, so the files are
  ready as soon as the user answers. Drafts stay out of the outputs folder
  until nothing is open.
- **No invented content.** SWS, exam forms and descriptions come only from
  the source documents. A list code without a handbook module gets its code
  and name, and "Keine Angabe" / "Not specified" where the schema demands a
  value. General knowledge never fills a field.

## 2. Priorities

When two goals conflict, the higher one wins:

1. **Completeness of codes.** Every code of the abbreviation list (and every
   subject of a timetable) is in the output, spelled exactly as printed.
   Timetables look subjects up by code; a missing code breaks the app.
2. **Correctness.** No value that isn't backed by the source.
3. **Richness.** Descriptions, translations, SWS splits. Nice to have.

Checks for priority 1 are enforced by scripts (`parse_list.py` recounts the
codes from the plain PDF text; `validate.py --list` fails on a missing list
code or a list code out of order), not just described in prose. The recount
must not depend on knowing the course types: it accepts any short type token,
so a faculty using a type this skill has never seen still gets counted.

## 3. The schemas are fixed

- `<task>/schema.json` is the contract with the app. **Never change a schema
  to make output fit.** If the schema must change, that is an app change and
  the user decides it.
- `scripts/validate.py` checks what a JSON schema can't (unknown keys, real
  dates, URL format, unique codes, 100-word descriptions, plain text). A
  rule that can be checked mechanically belongs in the validator.
- Codes are unique in a degreeinformation file. Never offer "two entries
  with the same code" as an option.

## 4. Generic, not programme-specific

The skill must work for every programme and faculty of the university, and
input layouts change between semesters.

- **Examples use placeholders only**: codes like `ABC3`, `MOD1`, `mMOD3/1`,
  `MOD/A`, `MOD2-NZ`, `101XYZ`; names like "Beispielfach", "Technik",
  "Muster Max"; rooms like `XY.123`; `<Kohorte>`, `<anderer Studiengang>`.
  Never real subject names, subject codes or programme codes, not even in
  code comments. When a real case motivates a rule, describe its pattern
  with a placeholder.
- Exception: things that are the fixed target of a task, such as the
  university's own web pages and the building codes on its locations page.
- Instructions describe a **reference layout** and tell the model to work
  out a different layout from the document itself, map what is unambiguous
  and ask about the rest. Don't hard-code one faculty's format as the only
  one.

## 5. Decided rules vs. questions

- A recurring question the user has answered once becomes a **decided rule**:
  write it into the task's `instructions.md` (with a generic example) and,
  if it is mechanical, into the script. Mark it as decided so it is not
  asked again.
- Keep "Ask the user" sections short and limited to real conflicts
  (ambiguous names without a tie-breaker, two candidate modules, missing
  required data, broken layouts).
- Current decided rules for degreeinformation (details in its
  `instructions.md`):
  - A code takes precedence. A list code without its own handbook module
    takes a module with an **equal** name, even if that module has another
    code. Merely similar names (extra number, group letter, cohort,
    course-form word) don't match.
  - A handbook statement of equivalence ("inhaltsgleich zu … <code>") is a
    match.
  - A name starting with a different code: drop that code. A name empty
    after cleaning: keep it as printed.
  - List-only codes: code and name only, no generated description.
  - Rows of one code naming different subjects, with no single `SU` row to
    prefer (e.g. `SU` and `SU/Pr` rows with different names), stay a question
    for the user. Don't add further tie-breakers (like "prefer the row whose
    Typ is exactly `SU`"): which name is right can't be told from the list.
  - SWS without a stated category go to `lecture`. A code's SWS are limited
    to the course types of its list rows (`MOD/A` `SU`, `MOD` `Pr` → lecture
    for one, laboratory for the other), so one module's hours are not
    counted once per code; a type the mapping doesn't know restricts nothing.

## 6. Where things live

| File | Role |
|---|---|
| `SKILL.md` | Trigger description, the workflow for all tasks, output format and file names. Kept short; details go into task folders. |
| `<task>/instructions.md` | Everything task-specific: inputs, steps, field rules, what to ask. |
| `<task>/schema.json` | Fixed output contract (see 3). |
| `<task>/*.py`, `scripts/validate.py` | Deterministic work: parsing, counting, cleaning, checking. |
| `no-shell.md` | The same workflow without Python. |
| `DESIGN.md` | This file. |

Division of labour: **scripts do what is mechanical and repeatable**
(rebuilding table rows, cleaning names, recounting codes, validating);
**instructions cover judgement** (matching modules, writing descriptions,
deciding when to ask).

## 7. Script conventions

- Standard library plus poppler-utils (`pdftotext`); `validate.py` needs
  `jsonschema`. Don't add heavier dependencies.
- Exit codes: `0` = fine; `2` = issues need a decision; `1` = input not
  recognised / invalid output; `3` = missing dependency; `4` = broken schema.
- Issues are printed as a list. Lines starting with `INFO` are already
  decided and informational; all others require a decision. `COMPLETENESS`
  issues must always be resolved before delivery.
- Working files (`list_<faculty>.json`, digests, `.entries.jsonl`) go to a
  drafts folder, never to the outputs folder.

## 8. Language and style

- Skill files are written in **English**. Source documents and quoted field
  labels stay in their original language (`Prüfung`, `Lernziele`, `SU`).
- Output data is bilingual (`de` / `en`). German text follows the source;
  English uses the established terms of the field, not word-by-word
  translation.
- Descriptions: one plain paragraph, at most 100 words per language, neutral
  voice, no Markdown.

## 9. Checklist for an edit

1. Change the rule in every place that states it: `SKILL.md` (if it
   affects the workflow), the task's `instructions.md`, `no-shell.md`
   (manual equivalent of any new automated check), and the scripts.
2. Keep all examples generic (see 4), including code comments.
3. Don't touch the schemas (see 3).
4. Test changed scripts on real input documents and run
   `validate.py` (with `--list` for degreeinformation) on a real output.
5. Add a new design decision to section 5 or the relevant section here.
6. Package the skill under its unchanged name (`zeiteisen-generator`) so the
   installed version is replaced, not duplicated.
