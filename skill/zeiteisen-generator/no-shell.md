# Working without a shell or Python

Read this when you can't run commands: there is no bash / code-execution
tool, or it exists but can't run Python (commands fail, no interpreter). The
tasks, rules, schemas and the "ask instead of guessing" principle stay
exactly the same. What changes is how you read the inputs, how you check the
output, and how you hand it over. Doing this by hand is slower and easier to
get wrong, so be more conservative: when in doubt, ask.

## 0. Prerequisites

- You still need each task's `instructions.md` and `schema.json`. Read them
  with whatever file tool you have (a view/read tool, project files, or text
  the user pasted). If you can't read the schema for a task, tell the user
  and don't produce that task's file; the format can't be guaranteed without
  it.
- Web tasks (dates, locations, handbook / study plan via website) need `web_search` /
  `web_fetch`, which work without a shell. Without web tools, say which tasks
  can't be done and ask the user to attach or paste the pages instead.

## 1. Reading PDFs

Attached PDFs usually appear in your context in two forms: an extracted text
layer and, for many clients, an image of each page. Use them like this:

- **Page image = ground truth** for layout: which boxes exist, which day
  column, where edges sit, red prefixes.
- **Text layer = spelling aid** only. It is often out of order, cells can be
  merged into one line, words can be glued together
  (`Fakultät: xyzAbkürzungen`), long names can look cut off, and whole cells
  can be missing.
- If you only get the text layer (no page image), you can't determine days
  and times of a timetable reliably. Don't reconstruct them from text order.
  Ask the user for a screenshot or image of the page (or to switch to an
  environment with code execution), and stop that timetable until then. An
  abbreviation list, handbook or study plan is fine from text alone (for a
  study plan, use the page image to confirm which number is in the `LP`
  column when the text layer runs columns together).

## 2. Timetables by hand

Follow `timetable/instructions.md` (steps 1-4 and all rules) with these
adjustments, since you can't render, crop or measure pixels:

1. Establish the grid from the image: the day column labels and the time-row
   labels on the left (in the reference layout 8 rows, with short rows around
   noon).
2. Go column by column, Monday to the block column, and within each column
   top to bottom and left to right. For every box note: title line, prefix,
   bracket hints, instructors, room, `#bei Bedarf`, and which row lines its
   top and bottom edges sit on or between.
3. Times: most edges sit on row boundaries. For an edge inside a row,
   estimate the fraction (1/4, 1/2, 3/4, ...) and apply the rule-3 formula,
   rounded to 15 minutes. If you can't tell whether an edge is on a boundary
   or part-way through a row, ask (name the box, say what you see).
4. Rotated or tiny text you can't read in the image: find the matching cell
   in the text layer (same code, group and room) and take the spelling from
   there. If neither source is clear, ask.
5. **Count check before writing JSON.** In the reference layout every box has
   exactly one room code, so the number of room codes in the text layer
   should equal your number of boxes (compare per room, e.g. three times
   `XY.123` in the text means three boxes with that room). Also count titles
   per code (`MOD1:SU:2.1` appears twice -> two boxes). Resolve every
   mismatch by looking at the image again; if it stays unresolved, ask.
6. Prefix check: in the text layer a repeat prefix appears right before its
   title (`G MOD1:Pr:10.2`); in the image it is red. Every box with a prefix
   in one source should have it in the other.

## 3. Degree files by hand

### The abbreviation list

Follow `degree/instructions.md`, step 1 (all rules, including
when to ask), reading the table from the text layer:

- Skip page headers and footers: the title (`Abkürzungen`), the column header
  (`Fachkürzel Typ Fach`), the semester/`Stand` line and the `Seite N
  Fakultät: …` line (it can be glued to the next page's title).
- A row starts with a code followed by a type (`SU`, `Pr`, `Ue`, `S`, `WF`
  or combinations with `/`), then the name. A line without a code and type
  continues the previous row's name (wrapped names); join a line ending in
  `-` without a space.
- Work through the list in order and in chunks (e.g. one page at a time),
  and keep a running count of rows and codes so nothing is skipped or
  duplicated. Mention the counts in the chat summary.

### The study plan

`parse_studyplan.py` can't run, so read the tables yourself, following step
1b of `degree/instructions.md` (all rules):

- Find every table with the columns `SWS` and `LP`: the semester plan
  ("Studienverlaufsplan") and the elective catalogues. Skip the change log
  ("Änderungsdienst"), abbreviations and footnotes.
- Per row note identifier (`Nr.` / `Modul-ID`), name and the number in the
  `LP` column. In the semester plan, sum the LP of an identifier that
  appears in several semesters; in catalogues, a repeated identifier is the
  same module. Rows without LP under a group heading are the heading's
  parts; the heading's LP is the sum of its parts. Mark elective-slot rows.
- **Count check:** add up the LP of the rows between two `Summe` lines and
  compare with the `Summe` value (e.g. 30 per semester). Every mismatch
  means a missed or misread row; resolve it before going on.

### The module handbook

`handbook_digest.py` can't run, so read the handbook's text layer directly,
following steps 2-4 of `degree/instructions.md`:

- Start with the table of contents to build the module index, then read one
  module at a time. Skip literature lists, staff and contact fields.
- Handbooks are long. Write the finished entries of each batch down (in a
  file if you have one, else keep them in your reply draft) before reading
  on, so earlier modules don't have to be re-read.
- If the handbook is too long to read completely, say up to which module you
  read; the rest counts as "no handbook module" for the matching.

## 4. Checking the output without the validator

`scripts/validate.py` can't run, so check each file yourself against its
`schema.json` before delivering:

- **JSON syntax:** double quotes only, no trailing commas, no comments, `true`
  / `false` lowercase, special characters in strings escaped (`"` and `\`).
- **Top level:** an array for timetables, an object for the other tasks.
- **File name:** exactly the pattern from SKILL.md; none of
  `< > : " / \ | ? *`, no trailing dot or space, no `CON`, `PRN`, `AUX`,
  `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9` before the first dot.
- **Degree file, most important:** go through the abbreviation list
  row by row and confirm every code is in the file, spelled exactly as
  printed, each exactly once (in any case: `ABC1` and `abc1` are one code
  to the app), in list order and before any handbook-only
  entries.
- **Keys:** every required key present; no key that the schema doesn't
  define, at any level (e.g. no `day` at the top level of a timetable entry).
- **Values:** every enum value exactly as listed in the schema (case
  matters); integers where integers are required (`8`, not `"8"` or `8.0`);
  numeric limits (hours 0-23, minutes 0-59, group numbers > 0); date strings
  as `YYYY-MM-DD` with real calendar dates; required strings not empty.
- **Structure-specific:** for timetables, weekly `repeat` has `type`, `day`,
  `startTime`, `endTime` and no `dates`; individual-date `repeat` has `type`
  `"I"` and a non-empty `dates` array and no `day`; `degreeProgram`, if
  present, is the same on every entry, a bare name without extension or `/`
  (`B-ABC`, not `B-ABC.degree`) that follows the file name rules above.
- **Degree file:** every code only once; each description at most
  100 words per language (count them); all texts one line, no Markdown.
  `lp`, when present, is a number (not a string), equals the LP of the
  matched study plan module, and never comes from an elective slot; entries
  without a plan module have no `lp` key at all (not `0`).
- **Consistency:** end time after start time; the entry count matches your
  count check; nothing invented to satisfy the schema (missing data is a
  question, not a guess).

Go through the file entry by entry, not by skimming. In the chat summary,
say that the files were checked by hand, not by the validator, and that a
spot check is recommended.

## 5. Handing over the files

Collect all questions first and ask them in one message, exactly as in
SKILL.md; deliver only when everything is resolved.

- **If you have a file-creation tool** (e.g. one that creates downloadable
  files or artifacts), create each file there with its exact file name and
  extension from SKILL.md (`.timetable` for timetables, `.degree` for degree
  files).
- **If you can only answer in chat,** give each file as its own code block,
  preceded by its exact file name, and tell the user to save the block's
  content (without the fence lines) under that name. The fence is only for
  display; the file content itself must still be plain JSON.
- Never shorten a file with `...` or "rest omitted". If a file is too long
  for one reply, say so, deliver it in consecutive parts that the user joins
  in order, and state clearly where each part starts and ends. For
  timetables prefer one complete file per reply.
