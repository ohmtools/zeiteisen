import { expect, test } from "vitest";
import { NOTES_KEY, NOTES_STRIP_KEY } from "@/lib/primitives/storage";
import { dropRetiredKeys } from "@/lib/retired";

function store(entries: Record<string, string>) {
  const data = new Map(Object.entries(entries));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => void data.delete(key),
  };
}

test("drops the old notes strip and keeps the notes", () => {
  const s = store({ [NOTES_STRIP_KEY]: '{"height":200,"collapsed":false}', [NOTES_KEY]: '"x"' });
  dropRetiredKeys(s);
  expect([...s.data.keys()]).toEqual([NOTES_KEY]);
});

test("changes nothing without the old key", () => {
  const s = store({ [NOTES_KEY]: '"x"' });
  dropRetiredKeys(s);
  expect([...s.data.keys()]).toEqual([NOTES_KEY]);
});

test("a refusing storage is no error", () => {
  const refusing = {
    getItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {},
  };
  expect(() => dropRetiredKeys(refusing)).not.toThrow();
});
