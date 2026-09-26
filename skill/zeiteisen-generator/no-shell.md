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
- Web tasks (dates, locations, handbook via website) need `web_search` /
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
  abbreviation list or handbook is fine from text alone.

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

## 3. Official abbreviation list by hand

Follow `degreeinformation/instructions.md`, Source A (all rules, including when
to ask), reading the table from the text layer:

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

## 4. Checking the output without the validator

`scripts/validate.py` can't run, so check each file yourself against its
`schema.json` before delivering:

- **JSON syntax:** double quotes only, no trailing commas, no comments, `true`
  / `false` lowercase, special characters in strings escaped (`"` and `\`).
- **Top level:** an array for timetables, an object for the other tasks.
- **Keys:** every required key present; no key that the schema doesn't
  define, at any level (e.g. no `day` at the top level of a timetable entry).
- **Values:** every enum value exactly as listed in the schema (case
  matters); integers where integers are required (`8`, not `"8"` or `8.0`);
  numeric limits (hours 0-23, minutes 0-59, group numbers > 0); date strings
  as `YYYY-MM-DD` with real calendar dates; required strings not empty.
- **Structure-specific:** for timetables, weekly `repeat` has `type`, `day`,
  `startTime`, `endTime` and no `dates`; individual-date `repeat` has `type`
  `"I"` and a non-empty `dates` array and no `day`.
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
  extension from SKILL.md (`.timetable` for timetables).
- **If you can only answer in chat,** give each file as its own code block,
  preceded by its exact file name, and tell the user to save the block's
  content (without the fence lines) under that name. The fence is only for
  display; the file content itself must still be plain JSON.
- Never shorten a file with `...` or "rest omitted". If a file is too long
  for one reply, say so, deliver it in consecutive parts that the user joins
  in order, and state clearly where each part starts and ends. For
  timetables prefer one complete file per reply.
