#!/usr/bin/env node
// Generate the /movies nav icon — a 16×16 pixel-art old-timey film projector.
// Mirrors scripts/gen-nav-icons.mjs conventions.

import { createCanvas } from "canvas";
import fs from "node:fs";

const SIZE = 16;

const c = createCanvas(SIZE, SIZE);
const ctx = c.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Color palette:
//   K = black outline / hub / spokes
//   B = projector body (dark warm grey)
//   b = body vents / shadow
//   r = reel face (cream)
//   L = lens glass (light teal)
//   . = transparent
const COLORS = {
  K: "#1a1a1a",
  B: "#5a4a52",
  b: "#3a2e34",
  r: "#f4e8c8",
  L: "#7fb3a8",
  ".": null,
};

// Side-view classroom film projector silhouette:
//  - Large top-mounted reel (9px diameter) on the left half — iconic
//    cream circle with a black hub/cross of spokes
//  - Reel arm/post connecting reel to body
//  - Rectangular body (rows 9-13) running full width
//  - Trapezoidal lens horn flaring outward to the right (rows 10-12)
//  - Two short feet at the bottom
const BITMAP = [
  "...KKKKK........",
  "..KrrrrrK.......",
  ".KrrrKrrrK......",
  ".KrKKKKKrK......",
  ".KrrrKrrrK......",
  "..KrrrrrK.......",
  "...KKKKK........",
  "....KKK.........",
  ".KKKKKKKKKKK....",
  ".KBBBBBBBBBK....",
  ".KBbbbbbbbBKKK..",
  ".KBbBBBBBbBLLLK.",
  ".KBbbbbbbbBKKK..",
  ".KBBBBBBBBBK....",
  ".KKKKKKKKKKK....",
  "..KK.....KK.....",
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
