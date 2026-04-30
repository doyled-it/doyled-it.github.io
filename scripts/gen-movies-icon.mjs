#!/usr/bin/env node
// Generate the /movies nav icon — a 16×16 pixel-art film reel.
// Mirrors scripts/gen-nav-icons.mjs conventions.

import { createCanvas } from "canvas";
import fs from "node:fs";

const SIZE = 16;

const c = createCanvas(SIZE, SIZE);
const ctx = c.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Color palette — chosen to sit visually with existing nav icons:
//   K = black outline / sprockets
//   r = reel rim (warm purple-grey)
//   d = reel face (dark teal)
//   l = highlight (light teal)
//   . = transparent
const COLORS = {
  K: "#1a1a1a",
  r: "#5e4b66",
  d: "#2d4a4d",
  l: "#7fb3a8",
  ".": null,
};

// 16×16 film reel: circular reel face with 5 visible spoke holes,
// black outline, hub, and a few film perforations along the bottom edge
// to suggest the strip continuing.
// 13×13 film reel centered in cols 1-13, rows 0-12. Outer black ring,
// dark-teal face, 4 transparent spoke "windows" (NW/NE/SW/SE) carved
// out around a "+" of dark-teal spokes, single purple-grey hub pixel
// at the geometric center. Rows 14-15 are the film strip with
// sprocket-tooth perforations.
const BITMAP = [
  "....KKKKKK......",
  "..KKddddddKK....",
  ".KddddddddddK...",
  ".Kdd..dd..ddK...",
  "Kdd...dd...ddK..",
  "Kd....dd....dK..",
  "KdddddrrdddddK..",
  "Kd....dd....dK..",
  "Kdd...dd...ddK..",
  ".Kdd..dd..ddK...",
  ".KddddddddddK...",
  "..KKddddddKK....",
  "....KKKKKK......",
  "................",
  "KKKKKKKKKKKKKKKK",
  "K..KK..KK..KK..K",
];

for (let y = 0; y < BITMAP.length; y++) {
  for (let x = 0; x < BITMAP[y].length; x++) {
    const ch = BITMAP[y][x];
    const col = COLORS[ch];
    if (col) {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

fs.mkdirSync("src/assets/sprites/nav", { recursive: true });
fs.writeFileSync("src/assets/sprites/nav/movies.png", c.toBuffer("image/png"));
console.log("wrote src/assets/sprites/nav/movies.png");
