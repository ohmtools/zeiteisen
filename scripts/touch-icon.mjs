// The iOS home screen icon: `public/logo.svg` rendered full-bleed to
// `public/apple-touch-icon.png` (180×180) with `web-shot` (headless chromium).
// iOS rounds the corners itself and paints transparent pixels black, so the
// squircle backdrop becomes a plain square and its rim goes. Run by hand after
// a logo change, commit the PNG: `node scripts/touch-icon.mjs`.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const SIZE = 180;

const logo = fs.readFileSync(path.join(root, "public/logo.svg"), "utf8");
const square = logo
  // The viewport is the icon: draw the 512-unit logo at the icon's size.
  .replace(/width="512" height="512"/, `width="${SIZE}" height="${SIZE}"`)
  .replace(/ rx="112" ry="112"/, "")
  .replace(/\s*<rect[^>]*stroke-opacity="0\.12"[^>]*\/>/, "");
if (square === logo || /rx="112"|stroke-opacity="0\.12"/.test(square)) {
  throw new Error("touch-icon: public/logo.svg changed shape, update the replacements");
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "touch-icon-"));
const source = path.join(dir, "touch-icon.svg");
fs.writeFileSync(source, square);
execFileSync(
  "web-shot",
  ["-s", `${SIZE}x${SIZE}`, source, path.join(root, "public/apple-touch-icon.png")],
  { stdio: "inherit" },
);
fs.rmSync(dir, { recursive: true });
