#!/usr/bin/env python3
"""Validate a generated JSON file against the schema of one task.

Usage:
    python3 scripts/validate.py <task> <output file>

<task> is one of: degreeinformation, dates, locations, timetable.

Checks, in addition to the JSON schema itself:
  * no keys that the schema does not define (at any nesting level)
  * `date` formats are real calendar dates
  * `uri` formats are absolute http(s) URLs without raw spaces/non-ASCII
The output file must contain JSON, whatever its extension (timetables use
`.timetable`, all other tasks `.json`).
Exit code 0 = valid. Anything else = do NOT deliver the file.
"""
import json
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
TASKS = ("degreeinformation", "dates", "locations", "timetable")


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
            errors.append(f"{path}: URL contains spaces or non-ASCII characters (percent-encode them)")
    if isinstance(instance, dict) and "properties" in schema:
        for key, value in instance.items():
            if key in schema["properties"]:
                errors += uri_problems(value, schema["properties"][key], f"{path}.{key}")
    elif isinstance(instance, list) and "items" in schema:
        for i, item in enumerate(instance):
            errors += uri_problems(item, schema["items"], f"{path}[{i}]")
    return errors


def jpath(error):
    return "$" + "".join(f"[{p}]" if isinstance(p, int) else f".{p}" for p in error.absolute_path)


def describe(error):
    """Readable messages; for oneOf, report the errors of the branch picked by `type`."""
    if error.validator == "oneOf" and isinstance(error.instance, dict):
        kind = error.instance.get("type")
        branch = [s for s in error.context
                  if kind is not None and s.schema_path and s.schema_path[0] == pick_branch(error, kind)]
        if branch:
            return [m for s in branch for m in describe(s)]
        return [f"{jpath(error)}: matches none (or several) of the allowed shapes; "
                f"`type` must be \"I\" (with `dates`) or a weekly value (with `day`)"]
    return [f"{jpath(error)}: {error.message}"]


def pick_branch(error, kind):
    for i, branch in enumerate(error.validator_value):
        t = branch.get("properties", {}).get("type", {})
        if t.get("const") == kind or kind in t.get("enum", []):
            return i
    return None


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in TASKS:
        print(__doc__)
        sys.exit(2)
    task, output_path = sys.argv[1], sys.argv[2]
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

    if errors:
        print(f"INVALID ({len(errors)} problem(s)):")
        for err in errors:
            print("  -", err)
        sys.exit(1)
    print("VALID")


if __name__ == "__main__":
    main()
