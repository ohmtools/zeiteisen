import { createContext } from "react";
import { noOverrides } from "@/lib/primitives/overrides";

// The lookup tables `useCatalog` derives, provided by App: blocks and the
// subject editor read them from here, so a new table re-renders them.
export const OverridesContext = createContext(noOverrides);
