import { createCanvas } from "canvas";
import fs from "node:fs";

const SIZE = 32;
const COLS = 8;
const ROWS = 4;
const canvas = createCanvas(SIZE * COLS, SIZE * ROWS);
const ctx = canvas.getContext("2d");

function drawAt(col, row, drawFn) {
  ctx.save();
  ctx.translate(col * SIZE, row * SIZE);
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx);
  ctx.restore();
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const W = "#fff";
const R = "#c41e3a";
const O = "#ddd";
const K = "#222";
const S = "#ccc";

// 14x14 baseball bitmap (centered in 32x32 at offset 9,9)
// Two vertical stitch lines with small notches, like the reference image
const ballPixels = [
  "....KKKKKK....",
  "..KKWWWWWWKK..",
  ".KWWWrWWrWWWK.",
  ".KWWrWWWWrWWK.",
  "KWWWrWWWWrWWWK",
  "KWWWrWWWWrWWWK",
  "KWWWrWWWWrWWWK",
  "KWWWrWWWWrWWWK",
  "KWWWrWWWWrWWWK",
  "KWWWrWWWWrWWWK",
  ".KWWrWWWWrWWK.",
  ".KWWWrWWrWWWK.",
  "..KKWWWWWWKK..",
  "....KKKKKK....",
];

// Slightly shifted stitching for animation frame 2
const ballPixels2 = [
  "....KKKKKK....",
  "..KKWWWWWWKK..",
  ".KWWrWWWWrWWK.",
  ".KWWrWWWWrWWK.",
  "KWWWrWWWWrWWWK",
  "KWWWWrWWrWWWWK",
  "KWWWWrWWrWWWWK",
  "KWWWWrWWrWWWWK",
  "KWWWWrWWrWWWWK",
  "KWWWrWWWWrWWWK",
  ".KWWrWWWWrWWK.",
  ".KWWWrWWrWWWK.",
  "..KKWWWWWWKK..",
  "....KKKKKK....",
];

const colorMap = { ".": null, K: K, O: O, W: W, r: R, k: "#bbb" };

function drawBallFromPixels(ctx, pixels, ox = 0, oy = 0) {
  const startX = 9 + ox;
  const startY = 9 + oy;
  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      const c = colorMap[pixels[y][x]];
      if (c) px(ctx, startX + x, startY + y, c);
    }
  }
}

function drawShadow(ctx, ox = 0) {
  rect(ctx, 11 + ox, 26, 10, 2, "rgba(0,0,0,0.12)");
}

function drawBall(ctx, frame = 0, ox = 0, oy = 0) {
  drawShadow(ctx, ox);
  drawBallFromPixels(ctx, frame === 0 ? ballPixels : ballPixels2, ox, oy);
}

function drawSleepingBall(ctx, frame) {
  drawBallFromPixels(ctx, ballPixels, 0, 4);
  ctx.fillStyle = "#555";
  ctx.font = "bold 7px monospace";
  if (frame === 0) {
    ctx.fillText("z", 22, 10);
  } else {
    ctx.fillText("z", 20, 12);
    ctx.fillText("z", 24, 7);
  }
}

function drawAlertBall(ctx) {
  drawBallFromPixels(ctx, ballPixels, 0, -2);
  ctx.fillStyle = "#c41e3a";
  ctx.font = "bold 9px monospace";
  ctx.fillText("!", 24, 10);
}

function drawMovingBall(ctx, dir, frame) {
  let ox = 0, oy = 0;
  if (dir.includes("N")) oy = -2;
  if (dir.includes("S")) oy = 2;
  if (dir.includes("E")) ox = 2;
  if (dir.includes("W")) ox = -2;

  // Motion lines behind the ball
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  if (frame === 1) {
    rect(ctx, 16 - ox * 3, 16 - oy * 3, 2, 2, "rgba(0,0,0,0.08)");
    rect(ctx, 16 - ox * 5, 16 - oy * 5, 1, 1, "rgba(0,0,0,0.05)");
  }

  drawShadow(ctx, ox);
  const bounce = frame === 0 ? -1 : 1;
  drawBallFromPixels(ctx, frame === 0 ? ballPixels : ballPixels2, ox, oy + bounce);
}

const layout = {
  idle:     [[3, 3]],
  alert:    [[7, 3]],
  sleeping: [[2, 0], [2, 1]],
  tired:    [[3, 2]],
  scratch:  [[5, 0], [6, 0], [7, 0]],
  N:        [[1, 2], [1, 3]],
  NE:       [[0, 2], [0, 3]],
  E:        [[3, 0], [3, 1]],
  SE:       [[5, 1], [5, 2]],
  S:        [[6, 3], [7, 2]],
  SW:       [[5, 3], [6, 1]],
  W:        [[4, 2], [4, 3]],
  NW:       [[1, 0], [1, 1]],
};

ctx.clearRect(0, 0, canvas.width, canvas.height);

drawAt(...layout.idle[0], (c) => { drawShadow(c); drawBallFromPixels(c, ballPixels); });
drawAt(...layout.alert[0], (c) => drawAlertBall(c));
drawAt(...layout.sleeping[0], (c) => drawSleepingBall(c, 0));
drawAt(...layout.sleeping[1], (c) => drawSleepingBall(c, 1));
drawAt(...layout.tired[0], (c) => { drawBallFromPixels(c, ballPixels, 0, 2); });
drawAt(...layout.scratch[0], (c) => drawBall(c, 0));
drawAt(...layout.scratch[1], (c) => drawBall(c, 1));
drawAt(...layout.scratch[2], (c) => drawBall(c, 0));

for (const dir of ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]) {
  for (let f = 0; f < layout[dir].length; f++) {
    drawAt(...layout[dir][f], (c) => drawMovingBall(c, dir, f));
  }
}

const out = "src/assets/sprites/baseball/sheet.png";
fs.mkdirSync("src/assets/sprites/baseball", { recursive: true });
fs.writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`wrote ${out}`);
