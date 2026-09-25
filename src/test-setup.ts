// The message functions run in the tests (labels end up in ICS descriptions
// and in warnings), and paraglide's `localStorage` strategy expects the
// browser API. A minimal in-memory stand-in keeps the base locale.
if (!("localStorage" in globalThis)) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
}
