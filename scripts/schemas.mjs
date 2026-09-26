// The upload formats' JSON schemas, shared by json-schema.mjs and skill.mjs.
//
// The zod mirrors in src/lib/primitives/ are the source; jiti loads that
// TypeScript directly. The primitives import nothing but relative paths, zod
// and ohash, so no alias and no generated code is needed.
import { createJiti } from "jiti";
import { z } from "zod";

const jiti = createJiti(import.meta.url);

const { subjectsFileSchema } = await jiti.import("../src/lib/primitives/subject.ts");
const { semesterDatesSchema, locationsSchema, degreeInformationSchema } = await jiti.import(
  "../src/lib/primitives/meta.ts",
);
const { catalogIndexSchema } = await jiti.import("../src/lib/primitives/catalog.ts");

// "input" = what an uploaded file must contain: fields with a default are optional.
const options = { io: "input", target: "draft-2020-12" };

// kind -> [name, zod schema]
export const schemas = {
  timetable: ["Timetable", subjectsFileSchema],
  dates: ["SemesterDates", semesterDatesSchema],
  locations: ["Locations", locationsSchema],
  degreeinformation: ["DegreeInformation", degreeInformationSchema],
  catalog: ["CatalogIndex", catalogIndexSchema],
};

export function jsonSchema(kind) {
  return z.toJSONSchema(schemas[kind][1], options);
}

// The way every schema is written out: two-space indent, trailing newline.
export function schemaText(kind) {
  return JSON.stringify(jsonSchema(kind), null, 2) + "\n";
}
