import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG_KEY, DATES_KEY, PROFILES_KEY } from "@/lib/primitives/storage";
import { STORAGE_PARTS, dataParts, deleteData, resetAndReload } from "@/lib/reset";

function memoryStore(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
}

describe("deleteData", () => {
  it("removes only the keys of the chosen parts", () => {
    const store = memoryStore({ [PROFILES_KEY]: "[]", [CATALOG_KEY]: "{}", [DATES_KEY]: "null" });
    expect(deleteData(["catalog"], store)).toBe(true);
    expect([...store.map.keys()]).toEqual([PROFILES_KEY, DATES_KEY]);
  });

  it("clears everything, leftovers included, when every part is chosen", () => {
    const store = memoryStore({ [PROFILES_KEY]: "[]", "tt.old.v0": "x" });
    expect(deleteData(dataParts, store)).toBe(true);
    expect(store.map.size).toBe(0);
  });

  it("leaves storage alone for the app files alone", () => {
    const store = memoryStore({ [PROFILES_KEY]: "[]" });
    expect(deleteData(["app"], store)).toBe(true);
    expect(store.map.size).toBe(1);
  });

  it("reports a refusal", () => {
    const store = {
      removeItem: () => {
        throw new Error("denied");
      },
      clear: () => {},
    };
    expect(deleteData(["profiles"], store)).toBe(false);
  });

  it("drops the catalog cache with the settings", () => {
    expect(STORAGE_PARTS.settings).toContain(CATALOG_KEY);
  });
});

describe("resetAndReload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes, empties the offline app files when chosen, then reloads", async () => {
    const reload = vi.fn();
    const unregister = vi.fn(async () => true);
    const deleted: string[] = [];
    vi.stubGlobal("location", { reload });
    vi.stubGlobal("navigator", {
      serviceWorker: { getRegistrations: async () => [{ unregister }] },
    });
    vi.stubGlobal("caches", {
      keys: async () => ["workbox-precache"],
      delete: async (key: string) => deleted.push(key) > 0,
    });
    localStorage.setItem(CATALOG_KEY, "{}");
    expect(await resetAndReload(["catalog", "app"])).toBe(true);
    expect(localStorage.getItem(CATALOG_KEY)).toBeNull();
    expect(unregister).toHaveBeenCalled();
    expect(deleted).toEqual(["workbox-precache"]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads nothing when the browser refuses", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    const refuse = vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(await resetAndReload(["profiles"])).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    refuse.mockRestore();
  });
});
