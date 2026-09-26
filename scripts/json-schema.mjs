// Prints the JSON schema of the upload formats to stdout.
//
// Usage: node scripts/json-schema.mjs [timetable|dates|locations|degreeinformation|catalog]
//   no argument   -> every schema in one object
//   timetable     -> a timetable file (plain Subject[]) alone
//   dates         -> the SemesterDates schema alone
//   locations     -> the catalog's locations.json
//   degreeinformation -> one file of the catalog's degreeinformation/
//   catalog       -> the catalog's index.json
//
// The schemas themselves live in schemas.mjs, shared with skill.mjs.
import { jsonSchema, schemas } from "./schemas.mjs";

const which = process.argv[2];

let output;
if (which === undefined) {
  output = Object.fromEntries(
    Object.entries(schemas).map(([kind, [name]]) => [name, jsonSchema(kind)]),
  );
} else if (schemas[which]) {
  output = jsonSchema(which);
} else {
  process.stderr.write(
    `unknown schema "${which}", expected one of ${Object.keys(schemas).join(", ")}\n`,
  );
  process.exit(1);
}

process.stdout.write(JSON.stringify(output, null, 2) + "\n");
