You are extracting the semester dates of TH Nürnberg into `schema.json`.

The page layout and its content change over time. The rules below describe
what to look for, not fixed positions. If the page no longer contains a
recognisable list of dates for one semester, ask the user (see SKILL.md).

## 1. Find the source page

Only fetch URLs that appear in the user's message or as links on pages you
have already fetched. Don't construct URLs yourself. Language counterparts
are reached through the page's language switcher (`EN` / `DE` link).

- **No link given:** start at
  `https://www.th-nuernberg.de/studium-karriere/wichtiges-zum-studienstart/termine-im-ueberblick/`
  and continue as for an overview page.
- **Overview page** (lists several semesters, e.g. "Terminübersicht
  Wintersemester 2026/27", "Terminübersicht Sommersemester 2026"; German or
  English): pick the target semester and follow its link.
  - The target is the **next** semester: the listed semester that starts
    after today. A winter semester starts on 1 October, a summer semester on
    15 March (as stated on the overview page; if the page states different
    dates, use those).
  - Example: on 19 September 2026 the overview lists WS 2026/27 and SS 2026.
    WS 2026/27 is the target.
  - If no listed semester starts after today (the next one isn't published
    yet), tell the user and ask whether they want the current semester
    instead.
- **Semester page** (one semester's date table, e.g. `…/wintersemester/` or
  `…/en/…/semester-schedule/winter-semester/`): use it directly.

Then open the same semester in the other language via the language switcher.
Take German texts from the German page and English texts from the English
page. Translate yourself only if the counterpart page doesn't exist or
doesn't cover the same semester. Keep proper names untranslated
(`StudyOhm`, `ASPO`, `Language Center`).

Fetching notes: if `web_fetch` refuses the start URL, `web_search` for
`TH Nürnberg Termine im Überblick` and fetch it from the results. The
German and English semester pages each list the full table near the end of
the page; in September 2026 both had the same 25 rows in the same order.

## 2. Semester fields

- There is no field for winter/summer; the schema only has `year`. Still
  name the semester (e.g. "Wintersemester 2026/27") in the chat summary.
- `year`: the first year of the semester name: `Wintersemester 2026/27` ->
  `2026`, `Sommersemester 2027` -> `2027`.
- `lectureStart`: the date of the first lecture day (e.g. "Beginn der
  planmäßigen Vorlesungen", "Vorlesungsbeginn", "start of lectures"). This is
  not the semester start (`Semesterbeginn`), unless the page lists them as the
  same day.
- `lectureEnd`: the date of the last lecture day (e.g. "letzter
  Lehrveranstaltungstag", "Vorlesungsende", "last day of lectures").
- If either lecture date is missing or ambiguous, ask the user.
- All dates use the format `YYYY-MM-DD`.

## 3. Events

Every row of the semester's date table becomes one event, in page order.
This includes the rows that also define `lectureStart` / `lectureEnd`.

- `startDate`: the first date of the row. For `01.10.2026` this is
  `2026-10-01`.
- `endDate`: only for ranges (`10.09.2026 bis 09.10.2026` -> start
  `2026-09-10`, end `2026-10-09`). Omit it for single days.
- A deadline like `bis spätestens 02.11.2026` / `no later than …` has
  `startDate` = that date and no `endDate`. Keep the deadline character in
  the title (e.g. "Deadline: …" / "Frist: …").
- `title.de` / `title.en`: the short core of the event, e.g.
  "Semesterbeginn" / "Start of semester", or "Online-Anmeldung in StudyOhm zu
  den Prüfungen" / "Online registration for examinations in StudyOhm".
- `description.de` / `description.en`: optional. Use it for everything else
  in the row: clock times (`9:00 bis 23:59`), sub-items ("Einführungs-
  veranstaltungen und Begrüßung der Studienanfänger*innen,
  Gruppeneinteilung"), audience restrictions ("nur Bachelorstudiengang
  Bauingenieurwesen") and notes in italics. Omit it if there is nothing
  beyond the title. Never drop information from a row.
- `noLectures`: `true` if the row marks a lecture-free day or period
  (`vorlesungsfrei …`, `vorlesungsfreie Zeit`, "no lectures", public
  holidays such as Tag der Deutschen Einheit, Weihnachten), otherwise
  `false`. Always include the property. Do not compute lecture-free days
  that appear only as general prose (e.g. the Easter/Pentecost rule on the
  overview page); only the dated rows count.

Already decided, don't ask:

- A row whose date is explicitly not announced yet (`wird noch bekannt
  gegeben`, "to be announced") on **both** pages is skipped. Mention the
  skipped row in the chat summary.
- A row with only one concrete date plus vague wording (e.g. `ab Juli -
  15.08.2026 lt. Zulassungsbescheid`): use that concrete date as `startDate`
  and omit `endDate`. Put the full original wording into `description`
  ("Ab Juli bis 15.08.2026 laut Zulassungsbescheid" / "From July to 15 Aug
  2026, as stated in the admission letter"). Every date you output must be a
  real `YYYY-MM-DD` date; never invent a missing day, month or year.
- German and English page disagree on a row's date: use the page with more
  information, i.e. a concrete date beats "to be announced" and a full range
  beats a single day. The titles and descriptions still come from each
  language's own page. Mention in the chat summary which page's date you
  used. Real example: the AR withdrawal period is `24.11.2026 bis
  30.11.2026` on the German page but "to be announced" on the English page,
  so use the German dates.

Ask the user (see SKILL.md) when:

- a row has no concrete date at all but also doesn't say it's not announced
  yet (e.g. "Mitte Oktober"). Quote the row and ask.
- the German and English pages give two different concrete dates for the
  same row (neither has more information), or the pages don't pair up row
  by row (different numbers of rows).
- the year of a date is missing and can't be inferred unambiguously.
