// The app icons, rendered from `public/logo.svg` with `web-shot` (headless
// chromium). Run by hand after a logo change, commit the PNGs:
// `node scripts/app-icons.mjs`.
//
// - `apple-touch-icon.png` (180): iOS takes its home screen icon only from
//   this link, never from the manifest. iOS rounds the corners itself and
//   paints transparent pixels black, so it is full-bleed: the squircle
//   backdrop becomes a plain square and its rim goes.
// - `icon-192.png`, `icon-512.png`: the manifest's PNGs next to the SVG, for
//   Android browsers that do not take an SVG icon. The logo as it is,
//   transparent corners included.
// - `icon-maskable-512.png`: Android crops an app icon to its own shape (circle,
//   rounded square); without a maskable one it shrinks the icon onto a white
//   plate. Full-bleed like the iOS one; the watch stays inside the safe zone
//   (a circle of 40% radius) as drawn, so nothing is cut off.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const logo = fs.readFileSync(path.join(root, "public/logo.svg"), "utf8");

// The viewport is the icon: draw the 512-unit logo at the icon's size.
const sized = (svg, size) =>
  svg.replace(/width="512" height="512"/, `width="${size}" height="${size}"`);

const fullBleed = logo
  .replace(/ rx="112" ry="112"/, "")
  .replace(/\s*<rect[^>]*stroke-opacity="0\.12"[^>]*\/>/, "");
if (
  !/width="512" height="512"/.test(logo) ||
  fullBleed === logo ||
  /rx="112"|stroke-opacity="0\.12"/.test(fullBleed)
) {
  throw new Error("app-icons: public/logo.svg changed shape, update the replacements");
}

const icons = [
  { file: "apple-touch-icon.png", size: 180, svg: fullBleed },
  { file: "icon-192.png", size: 192, svg: logo, transparent: true },
  { file: "icon-512.png", size: 512, svg: logo, transparent: true },
  { file: "icon-maskable-512.png", size: 512, svg: fullBleed },
];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "app-icons-"));
for (const { file, size, svg, transparent } of icons) {
  const source = path.join(dir, `${file}.svg`);
  fs.writeFileSync(source, sized(svg, size));
  execFileSync(
    "web-shot",
    [
      ...(transparent ? ["-t"] : []),
      "-s",
      `${size}x${size}`,
      source,
      path.join(root, "public", file),
    ],
    { stdio: "inherit" },
  );
}
fs.rmSync(dir, { recursive: true });
