// Link preview cards (Open Graph image) for WhatsApp / Discord: writes
// `scripts/og/og.svg` + `og-share.svg` from one template and renders each to
// `public/og.png` / `public/og-share.png` (1200×630) with `web-shot`
// (headless chromium). `social-preview` is the og card on GitHub's 1280×640,
// rendered next to its SVG: uploaded by hand in the repository settings.
// Run by hand after a design change, commit the PNGs:
// `node scripts/og/card.mjs`. Marketing, not app UI, but in the app's
// colours: OLED black, the red accent, blocks coloured by kind.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const root = path.resolve(here, "../..");
const font = path.relative(
  here,
  path.join(root, "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"),
);

// Blocks as in the app's dark theme: coloured by kind, [fill, border].
const kinds = {
  SU: ["#111111", "#2E2E2E"],
  Ue: ["#0D1F3C", "#2563EB"],
  Pr: ["#4A1A04", "#F97316"],
  Tu: ["#062B2A", "#0D9488"],
  S: ["#25104D", "#7C3AED"],
};

// The pocket watch of `public/favicon.svg`, drawn in its own 384-unit box.
const watch = `
  <rect x="244" y="112" width="24" height="30" rx="7" fill="#FAFAFA"/>
  <circle cx="256" cy="100" r="20" fill="none" stroke="#FAFAFA" stroke-width="18"/>
  <circle cx="256" cy="288" r="144" fill="#0A0A0A" stroke="#FAFAFA" stroke-width="22"/>
  <rect x="174" y="202" width="70" height="80" rx="12" fill="#DC2626"/>
  <rect x="174" y="294" width="70" height="80" rx="12" fill="#FAFAFA"/>
  <rect x="258" y="202" width="80" height="172" rx="12" fill="#F97316"/>`;

// Mini week: [day 0–4, start row, rows, subject, kind].
const blocks = [
  [0, 0, 2, "I2", "Pr"],
  [0, 3, 2, "M1", "SU"],
  [1, 1, 2, "EM", "SU"],
  [1, 4, 2, "M1", "Ue"],
  [2, 0, 2, "ELK1", "SU"],
  [2, 2, 2, "EM", "Tu"],
  [3, 2, 3, "SDS", "S"],
  [4, 0, 2, "ELK1", "Pr"],
  [4, 3, 2, "I2", "SU"],
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
      `<line x1="${grid.x}" x2="${grid.x + grid.w}" y1="${y}" y2="${y}" stroke="#1F1F1F" stroke-width="2"/>`,
    );
  }
  for (const [day, row, rows, subject, kind] of blocks) {
    const x = grid.x + day * (colW + grid.gap);
    const y = grid.y + grid.head + row * rowH + 4;
    const h = rows * rowH - 8;
    const [fill, border] = kinds[kind];
    out.push(
      `<rect x="${x + 1}" y="${y + 1}" width="${colW - 2}" height="${h - 2}" rx="11" fill="${fill}" stroke="${border}" stroke-width="2"/>`,
    );
    out.push(`<text x="${x + 14}" y="${y + 32}" class="subject">${subject}</text>`);
    out.push(`<text x="${x + 14}" y="${y + 58}" class="kind">${kind}</text>`);
  }
  return out.join("\n  ");
}

function card(lines, [width, height] = [1200, 630]) {
  const text = lines
    .map(
      ([y, size, weight, colour, value]) =>
        `<text x="72" y="${y}" font-size="${size}" font-weight="${weight}" fill="${colour}">${value}</text>`,
    )
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      @font-face { font-family: Geist; src: url("${font}") format("woff2"); font-weight: 100 900; }
      text { font-family: Geist, sans-serif; letter-spacing: -0.01em; }
      .day { font-size: 22px; font-weight: 500; fill: #A3A3A3; }
      .subject { font-size: 24px; font-weight: 600; fill: #FAFAFA; }
      .kind { font-size: 20px; font-weight: 500; fill: #D4D4D4; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="#000000"/>
  <rect x="0" y="0" width="${width}" height="8" fill="#DC2626"/>
  <g transform="translate(${(width - 1200) / 2} ${(height - 630) / 2})">
  <svg x="64" y="76" width="104" height="104" viewBox="64 64 384 384">${watch}
  </svg>
  <text x="184" y="148" font-size="60" font-weight="600" fill="#FAFAFA">Zeiteisen</text>
  ${text}
  ${gridSvg()}
  </g>
</svg>
`;
}

const ogLines = [
  [350, 46, 600, "#FAFAFA", "Gruppen kombinieren,"],
  [408, 46, 600, "#FAFAFA", "Stundenplan"],
  [466, 46, 600, "#FAFAFA", "ausprobieren"],
];

// [svg, size, PNG path]
const cards = {
  og: [card(ogLines), "1200x630", path.join(root, "public", "og.png")],
  "og-share": [
    card([
      [340, 52, 600, "#FAFAFA", "Stundenplan"],
      [404, 52, 600, "#FAFAFA", "geteilt"],
      [480, 28, 500, "#A3A3A3", "Öffnen, um die"],
      [520, 28, 500, "#A3A3A3", "Gruppen anzusehen"],
    ]),
    "1200x630",
    path.join(root, "public", "og-share.png"),
  ],
  "social-preview": [card(ogLines, [1280, 640]), "1280x640", path.join(here, "social-preview.png")],
};

for (const [name, [svg, size, png]] of Object.entries(cards)) {
  const source = path.join(here, `${name}.svg`);
  fs.writeFileSync(source, svg);
  execFileSync("web-shot", ["-s", size, source, png], { stdio: "inherit" });
}
