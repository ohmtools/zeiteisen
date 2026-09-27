#!/usr/bin/env python3
"""Validate a generated JSON file against the schema of one task.

Usage:
    python3 scripts/validate.py <task> <output file> [--list <list_<faculty>.json>]

<task> is one of: dates, degreeinformation, locations, timetable.

Checks, in addition to the JSON schema itself:
  * no keys that the schema does not define (at any nesting level)
  * `date` formats are real calendar dates
  * `uri` formats are absolute http(s) URLs without raw spaces/non-ASCII
  * timetable: a group index is at most its category (group 2.3 does not
    exist), and every slot ends after it starts; the app refuses the first
    and cannot show the second
  * degreeinformation: codes unique, descriptions at most 100 words per
    language, texts single-line without Markdown; with --list (the working
    file of parse_list.py): every code of the abbreviation list is present,
    spelled exactly as in the list (this check is the most important one), and
    list codes come first, in list order, before handbook-only codes.
  * the file name saves on Windows, macOS / iOS, Linux and Android (the app
    names a timetable after its file): none of < > : " / \\ | ? * or control
    characters, no trailing dot or space, no reserved Windows device name
    (CON, PRN, AUX, NUL, COM1-9, LPT1-9, also before an extension), at most
    255 bytes; and the extension the task uses.
The output file must contain JSON, whatever its extension (timetables use
`.timetable`, all other tasks `.json`).
Exit code 0 = valid. Anything else = do NOT deliver the file.
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

try:
    import jsonschema
except ImportError:
    print("jsonschema missing: run `pip install jsonschema --break-system-packages`")
    sys.exit(3)

SKILL_DIR = Path(__file__).resolve().parent.parent
VALIDATOR_CLS = jsonschema.Draft202012Validator
TASKS = ("dates", "degreeinformation", "locations", "timetable")
MAX_DESCRIPTION_WORDS = 100

# The app's own file name rule (`src/lib/primitives/name.ts`): Windows / FAT
# are the strictest of the systems the files land on, so theirs apply.
FORBIDDEN_NAME = re.compile(r'[<>:"/\\|?*\x00-\x1f\x7f]')
RESERVED_NAME = re.compile(
    r"^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$", re.IGNORECASE
)


def name_problems(output_path, task):
    name = Path(output_path).name
    extension = ".timetable" if task == "timetable" else ".json"
    problems = []
    if not name.endswith(extension):
        problems.append(f"file name {name!r}: must end in {extension}")
    if FORBIDDEN_NAME.search(name):
        problems.append(
            f'file name {name!r}: contains one of < > : " / \\ | ? * or a control character; use -'
        )
    if name.endswith((".", " ")):
        problems.append(f"file name {name!r}: ends with a dot or space")
    if RESERVED_NAME.match(name.split(".")[0].rstrip()):
        problems.append(f"file name {name!r}: reserved on Windows")
    if len(name.encode("utf-8")) > 255:
        problems.append(f"file name {name!r}: longer than 255 bytes")
    return problems


def resolve(instance, schema):
    """For oneOf/anyOf, return the branch the instance matches (else the schema itself)."""
    for combo in ("oneOf", "anyOf"):
        if combo in schema:
            matches = [b for b in schema[combo] if VALIDATOR_CLS(b).is_valid(instance)]
            if len(matches) == 1:
                return resolve(instance, matches[0])
            return {}  # no/ambiguous match: already reported by the schema errors
    return schema


def extra_keys(instance, schema, path="$"):
    """Yield paths of keys not declared in the schema's `properties`."""
    schema = resolve(instance, schema)
    errors = []
    if isinstance(instance, dict) and "properties" in schema:
        for key, value in instance.items():
            if key not in schema["properties"]:
                errors.append(f"{path}.{key}: key not defined in schema")
            else:
                errors += extra_keys(value, schema["properties"][key], f"{path}.{key}")
    elif isinstance(instance, list) and "items" in schema:
        for i, item in enumerate(instance):
            errors += extra_keys(item, schema["items"], f"{path}[{i}]")
    return errors


def uri_problems(instance, schema, path="$"):
    schema = resolve(instance, schema)
    errors = []
    if schema.get("format") == "uri" and isinstance(instance, str):
        parsed = urlparse(instance)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            errors.append(f"{path}: not an absolute http(s) URL")
        if any(c.isspace() or ord(c) > 127 for c in instance):
            errors.append(
                f"{path}: URL contains spaces or non-ASCII characters (percent-encode them)"
            )
    if isinstance(instance, dict) and "properties" in schema:
        for key, value in instance.items():
            if key in schema["properties"]:
                errors += uri_problems(
                    value, schema["properties"][key], f"{path}.{key}"
                )
    elif isinstance(instance, list) and "items" in schema:
        for i, item in enumerate(instance):
            errors += uri_problems(item, schema["items"], f"{path}[{i}]")
    return errors


def timetable_problems(data):
    """Rules of the app's timetable format that the JSON schema can't express."""
    errors = []
    if not isinstance(data, list):
        return errors

    def minutes(t):
        return (
            t["hour"] * 60 + t["minute"]
            if isinstance(t, dict) and "hour" in t and "minute" in t
            else None
        )

    for i, s in enumerate(data):
        if not isinstance(s, dict):
            continue
        name = s.get("name")
        group = s.get("group")
        if isinstance(group, dict):
            cat, idx = group.get("category"), group.get("index")
            if isinstance(cat, int) and isinstance(idx, int) and idx > cat:
                errors.append(
                    f"$[{i}].group ({name}): index {idx} exceeds category {cat}; "
                    f"category n has groups n.1 to n.n"
                )
        repeat = s.get("repeat") if isinstance(s.get("repeat"), dict) else {}
        slots = repeat.get("dates") if repeat.get("type") == "I" else [repeat]
        for j, slot in enumerate(slots if isinstance(slots, list) else []):
            if not isinstance(slot, dict):
                continue
            start, end = minutes(slot.get("startTime")), minutes(slot.get("endTime"))
            if start is not None and end is not None and end <= start:
                where = f"$[{i}].repeat" + (
                    f".dates[{j}]" if repeat.get("type") == "I" else ""
                )
                errors.append(f"{where} ({name}): endTime is not after startTime")
    return errors


def degree_problems(data):
    """Rules of degreeinformation/instructions.md that a JSON schema can't express."""
    errors, seen = [], {}
    subjects = data.get("subjects", []) if isinstance(data, dict) else []
    for i, s in enumerate(subjects):
        if not isinstance(s, dict):
            continue
        code = s.get("code")
        if code in seen:
            errors.append(
                f"$.subjects[{i}].code: {code!r} already used by $.subjects[{seen[code]}]"
            )
        seen.setdefault(code, i)
        for field in ("name", "description", "test"):
            for lang, text in (s.get(field) or {}).items():
                if not isinstance(text, str):
                    continue
                where = f"$.subjects[{i}].{field}.{lang} ({code})"
                if text != text.strip() or "\n" in text:
                    errors.append(f"{where}: leading/trailing whitespace or line break")
                if re.search(r"(\*\*|__|^#|^\s*[-*•] )", text):
                    errors.append(
                        f"{where}: looks like Markdown or a bullet list; use plain prose"
                    )
                if field == "description":
                    words = len(text.split())
                    if words > MAX_DESCRIPTION_WORDS:
                        errors.append(
                            f"{where}: {words} words, max {MAX_DESCRIPTION_WORDS}"
                        )
    return errors


def jpath(error):
    return "$" + "".join(
        f"[{p}]" if isinstance(p, int) else f".{p}" for p in error.absolute_path
    )


def describe(error):
    """Readable messages; for oneOf, report the errors of the branch picked by `type`."""
    if error.validator == "oneOf" and isinstance(error.instance, dict):
        kind = error.instance.get("type")
        branch = [
            s
            for s in error.context
            if kind is not None
            and s.schema_path
            and s.schema_path[0] == pick_branch(error, kind)
        ]
        if branch:
            return [m for s in branch for m in describe(s)]
        return [
            f"{jpath(error)}: matches none (or several) of the allowed shapes; "
            f'`type` must be "I" (with `dates`) or a weekly value (with `day`)'
        ]
    return [f"{jpath(error)}: {error.message}"]


def pick_branch(error, kind):
    for i, branch in enumerate(error.validator_value):
        t = branch.get("properties", {}).get("type", {})
        if t.get("const") == kind or kind in t.get("enum", []):
            return i
    return None


def list_coverage(data, list_path):
    """Every code of the abbreviation list must be in the output (exact spelling)."""
    entries = json.loads(Path(list_path).read_text(encoding="utf-8")).get("entries", [])
    have = {s.get("code") for s in data.get("subjects", []) if isinstance(s, dict)}
    missing = [e["code"] for e in entries if e["code"] not in have]
    print(
        f"list coverage: {len(entries) - len(missing)} of {len(entries)} list codes present"
    )
    errors = [f"list code {c!r} missing from the output" for c in missing]
    # order: list codes first, in list order; handbook-only codes after them
    rank = {e["code"]: i for i, e in enumerate(entries)}
    last, seen_other = -1, None
    for s in data.get("subjects", []):
        c = s.get("code") if isinstance(s, dict) else None
        if c in rank:
            if seen_other is not None:
                errors.append(
                    f"list code {c!r} comes after handbook-only code {seen_other!r}; list codes go first"
                )
                break
            if rank[c] < last:
                errors.append(f"list code {c!r} is out of list order")
                break
            last = rank[c]
        elif c is not None and seen_other is None:
            seen_other = c
    return errors


def main():
    args = sys.argv[1:]
    list_path = None
    if "--list" in args:
        i = args.index("--list")
        if i + 1 >= len(args):
            print(__doc__)
            sys.exit(1)
        list_path = args[i + 1]
        del args[i : i + 2]
    if len(args) != 2 or args[0] not in TASKS:
        print(__doc__)
        sys.exit(1)
    task, output_path = args[0], args[1]
    schema_path = SKILL_DIR / task / "schema.json"

    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"SCHEMA ERROR: {schema_path} cannot be loaded ({exc}).")
        print("The schema itself is broken. Do not edit it; report this to the user.")
        sys.exit(4)

    try:
        data = json.loads(Path(output_path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"OUTPUT ERROR: {output_path} is not valid JSON ({exc}).")
        sys.exit(1)

    global VALIDATOR_CLS
    VALIDATOR_CLS = jsonschema.validators.validator_for(schema)
    validator = VALIDATOR_CLS(schema, format_checker=VALIDATOR_CLS.FORMAT_CHECKER)
    errors = []
    for e in validator.iter_errors(data):
        errors += describe(e)
    errors += extra_keys(data, schema)
    errors += uri_problems(data, schema)
    errors += name_problems(output_path, task)
    if task == "timetable":
        errors += timetable_problems(data)
    if task == "degreeinformation":
        errors += degree_problems(data)
        if list_path:
            errors += list_coverage(data, list_path)

    if errors:
        print(f"INVALID ({len(errors)} problem(s)):")
        for err in errors:
            print("  -", err)
        sys.exit(1)
    print("VALID")


if __name__ == "__main__":
    main()
