import { expect, test } from "vitest";
import { base64UrlToBoolArray, boolArrayToBase64Url } from "./bitCodec";
import { isOverlapping, parseGroupName } from "./group";

test("parseGroupName", () => {
  expect(parseGroupName("3.2")).toEqual({ category: 3, index: 2 });
  for (const bad of ["foo", "2.3", "2.0", "0.0", "1.1.1", "1.", " 1.1"]) {
    expect(parseGroupName(bad)).toBeNull();
  }
});

test("isOverlapping leaves the input order alone", () => {
  const groups = [
    { category: 3, index: 1 },
    { category: 2, index: 2 },
  ];
  expect(isOverlapping(groups)).toEqual([false, "3.1"]);
  expect(groups[0].category).toBe(3);
  expect(
    isOverlapping([
      { category: 6, index: 2 },
      { category: 3, index: 1 },
    ])[0],
  ).toBe(true);
});

test("bit codec round trips and rejects a wrong length", () => {
  for (const n of [0, 1, 7, 8, 9, 100]) {
    const bits = Array.from({ length: n }, (_, i) => i % 3 === 0);
    expect(base64UrlToBoolArray(boolArrayToBase64Url(bits), n)).toEqual(bits);
  }
  const encoded = boolArrayToBase64Url(Array(20).fill(true));
  expect(() => base64UrlToBoolArray(encoded.slice(0, -2), 20)).toThrow();
  expect(() => base64UrlToBoolArray(encoded, 8)).toThrow();
});
