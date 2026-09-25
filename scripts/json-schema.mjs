// Prints the JSON schema of the upload formats to stdout.
//
// Usage: node scripts/json-schema.mjs [timetable|dates|locations|abbreviations|catalog]
//   no argument   -> every schema in one object
//   timetable     -> a timetable file (plain Subject[]) alone
//   dates         -> the SemesterDates schema alone
//   locations     -> the catalog's locations.json
//   abbreviations -> one file of the catalog's abbreviations/
//   catalog       -> the catalog's index.json
//
// The zod mirrors in src/lib/primitives/ are the source; jiti loads that
// TypeScript directly. The primitives import nothing but relative paths, zod
// and ohash, so no alias and no generated code is needed.
import { createJiti } from "jiti";
import { z } from "zod";

const jiti = createJiti(import.meta.url);

const { subjectsFileSchema } = await jiti.import("../src/lib/primitives/subject.ts");
const { semesterDatesSchema, locationsSchema, abbreviationsSchema } = await jiti.import(
  "../src/lib/primitives/meta.ts",
);
const { catalogIndexSchema } = await jiti.import("../src/lib/primitives/catalog.ts");

// "input" = what an uploaded file must contain: fields with a default are optional.
const options = { io: "input", target: "draft-2020-12" };

const schemas = {
  timetable: ["Timetable", subjectsFileSchema],
  dates: ["SemesterDates", semesterDatesSchema],
  locations: ["Locations", locationsSchema],
  abbreviations: ["Abbreviations", abbreviationsSchema],
  catalog: ["CatalogIndex", catalogIndexSchema],
};

const which = process.argv[2];

let output;
if (which === undefined) {
  output = Object.fromEntries(
    Object.values(schemas).map(([name, schema]) => [name, z.toJSONSchema(schema, options)]),
  );
} else if (schemas[which]) {
  output = z.toJSONSchema(schemas[which][1], options);
} else {
  process.stderr.write(
    `unknown schema "${which}", expected one of ${Object.keys(schemas).join(", ")}\n`,
  );
  process.exit(1);
}

process.stdout.write(JSON.stringify(output, null, 2) + "\n");
