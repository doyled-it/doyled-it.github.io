#!/usr/bin/env node
// Generate a clean 16x16 pixel-art baseball PNG for page-header use.
import { createCanvas } from "canvas";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/assets/sprites/scenes");
const W = "#fafafa";
const R = "#c41e3a";
const K = "#000";

// 14x14 baseball bitmap centered in a 16x16 canvas
const pixels = [
  "....KKKKKK....",
  "..KKWWWWWWKK..",
  ".KWrWWWWWWrWK.",
  ".KWrWWWWWWrWK.",
  "KWWrWWWWWWrWWK",
  "KWWWrWWWWrWWWK",
  "KWWWrWWWWrWWWK",
  "KWWWrWWWWrWWWK",
  "KWWWrWWWWrWWWK",
  "KWWrWWWWWWrWWK",
  ".KWrWWWWWWrWK.",
  ".KWrWWWWWWrWK.",
  "..KKWWWWWWKK..",
  "....KKKKKK....",
];
const color = { ".": null, K, W, r: R };

const size = 16;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

for (let y = 0; y < pixels.length; y++) {
  for (let x = 0; x < pixels[y].length; x++) {
    const c = color[pixels[y][x]];
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect(1 + x, 1 + y, 1, 1);
  }
}

const out = path.join(outDir, "ball-header.png");
fs.writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`wrote ${out} (${size}x${size})`);
