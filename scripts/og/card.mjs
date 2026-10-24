// Link preview cards (Open Graph image) for WhatsApp / Discord: writes
// `scripts/og/og.svg` + `og-share.svg` from one template and renders each to
// `public/og.png` / `public/og-share.png` (1200×630) with `web-shot`
// (headless chromium). Run by hand after a design change, commit the PNGs:
// `node scripts/og/card.mjs`. Marketing, not app UI: own colours allowed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const root = path.resolve(here, "../..");
const font = path.relative(
  here,
  path.join(root, "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"),
);

// The favicon's reds (light → dark).
const tints = ["#E23A46", "#C10007", "#9E0711", "#6E050C"];

// The pocket watch of `public/favicon.svg`, drawn in its own 384-unit box.
const watch = `
  <rect x="244" y="112" width="24" height="30" rx="7" fill="url(#bezel)"/>
  <circle cx="256" cy="100" r="20" fill="none" stroke="url(#bezel)" stroke-width="18"/>
  <circle cx="256" cy="288" r="144" fill="url(#face)" stroke="url(#bezel)" stroke-width="22"/>
  <rect x="174" y="202" width="70" height="80" rx="12" fill="url(#scarlet)"/>
  <rect x="174" y="294" width="70" height="80" rx="12" fill="#FFFFFF"/>
  <rect x="258" y="202" width="80" height="172" rx="12" fill="url(#maroon)"/>`;

// Mini week: [day 0–4, start row, rows, subject, kind, tint (-1 = white)].
const blocks = [
  [0, 0, 2, "I2", "Pr", 2],
  [0, 3, 2, "M1", "SU", 0],
  [1, 1, 2, "EM", "SU", 1],
  [1, 4, 2, "M1", "Ue", -1],
  [2, 0, 2, "ELK1", "SU", 3],
  [2, 2, 2, "EM", "Tu", 0],
  [3, 2, 3, "SDS", "S", 2],
  [4, 0, 2, "ELK1", "Pr", 1],
  [4, 3, 2, "I2", "SU", 3],
];

const grid = { x: 628, y: 92, w: 500, h: 446, head: 44, rows: 6, gap: 8 };
const colW = (grid.w - grid.gap * 4) / 5;
const rowH = (grid.h - grid.head) / grid.rows;

function gridSvg() {
  const days = ["Mo", "Di", "Mi", "Do", "Fr"];
  const out = [];
  days.forEach((day, i) => {
    const x = grid.x + i * (colW + grid.gap) + colW / 2;
    out.push(`<text x="${x}" y="${grid.y + 26}" text-anchor="middle" class="day">${day}</text>`);
  });
  for (let r = 0; r <= grid.rows; r++) {
    const y = grid.y + grid.head + r * rowH;
    out.push(
      `<line x1="${grid.x}" x2="${grid.x + grid.w}" y1="${y}" y2="${y}" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2"/>`,
    );
  }
  for (const [day, row, rows, subject, kind, tint] of blocks) {
    const x = grid.x + day * (colW + grid.gap);
    const y = grid.y + grid.head + row * rowH + 4;
    const h = rows * rowH - 8;
    const fill = tint < 0 ? "#FFFFFF" : tints[tint];
    const ink = tint < 0 ? "#12151A" : "#FFFFFF";
    out.push(`<rect x="${x}" y="${y}" width="${colW}" height="${h}" rx="12" fill="${fill}"/>`);
    out.push(`<text x="${x + 14}" y="${y + 32}" class="subject" fill="${ink}">${subject}</text>`);
    out.push(
      `<text x="${x + 14}" y="${y + 58}" class="kind" fill="${ink}" fill-opacity="0.8">${kind}</text>`,
    );
  }
  return out.join("\n  ");
}

function card(lines) {
  const text = lines
    .map(
      ([y, size, weight, colour, value]) =>
        `<text x="72" y="${y}" font-size="${size}" font-weight="${weight}" fill="${colour}">${value}</text>`,
    )
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <style>
      @font-face { font-family: Geist; src: url("${font}") format("woff2"); font-weight: 100 900; }
      text { font-family: Geist, sans-serif; letter-spacing: -0.01em; }
      .day { font-size: 22px; font-weight: 600; fill: #D6D3CE; }
      .subject { font-size: 24px; font-weight: 700; }
      .kind { font-size: 20px; font-weight: 500; }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#1E232D"/>
      <stop offset="100%" stop-color="#101216"/>
    </linearGradient>
    <radialGradient id="face" cx="42%" cy="32%" r="75%">
      <stop offset="0%" stop-color="#262B35"/>
      <stop offset="100%" stop-color="#12151A"/>
    </radialGradient>
    <linearGradient id="bezel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F5F5F4"/>
      <stop offset="45%" stop-color="#D6D3CE"/>
      <stop offset="100%" stop-color="#8C8884"/>
    </linearGradient>
    <linearGradient id="scarlet" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E23A46"/>
      <stop offset="100%" stop-color="#9E0711"/>
    </linearGradient>
    <linearGradient id="maroon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9E0711"/>
      <stop offset="100%" stop-color="#5C040A"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="8" fill="#C10007"/>
  <svg x="64" y="76" width="104" height="104" viewBox="64 64 384 384">${watch}
  </svg>
  <text x="184" y="148" font-size="60" font-weight="700" fill="#FFFFFF">Zeiteisen</text>
  ${text}
  ${gridSvg()}
</svg>
`;
}

const cards = {
  og: card([
    [350, 46, 700, "#FFFFFF", "Gruppen kombinieren,"],
    [408, 46, 700, "#FFFFFF", "Stundenplan"],
    [466, 46, 700, "#FFFFFF", "ausprobieren"],
  ]),
  "og-share": card([
    [340, 52, 700, "#FFFFFF", "Stundenplan"],
    [404, 52, 700, "#FFFFFF", "geteilt"],
    [480, 28, 500, "#D6D3CE", "Öffnen, um die"],
    [520, 28, 500, "#D6D3CE", "Gruppen anzusehen"],
  ]),
};

for (const [name, svg] of Object.entries(cards)) {
  const source = path.join(here, `${name}.svg`);
  fs.writeFileSync(source, svg);
  execFileSync("web-shot", ["-s", "1200x630", source, path.join(root, "public", `${name}.png`)], {
    stdio: "inherit",
  });
}
