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

const GREEN = "#228b22";
const DGREEN = "#1a6b1a";
const BLACK = "#222";
const GRAY = "#888";
const LGRAY = "#ccc";
const WHEEL = "#333";
const ROOF = "#e0e0e0";
const GLASS = "#87ceeb";
const BROWN = "#8B4513";
const LBROWN = "#a0622d";
const SEAT = "#6B3410";

function drawCartRight(ctx, bounceY = 0) {
  const y = 6 + bounceY;
  // Roof
  rect(ctx, 7, y, 18, 2, ROOF);
  rect(ctx, 8, y + 2, 1, 5, LGRAY); // front post
  rect(ctx, 23, y + 2, 1, 4, LGRAY); // rear post

  // Windshield
  rect(ctx, 9, y + 3, 5, 4, GLASS);

  // Body
  rect(ctx, 6, y + 7, 21, 7, GREEN);
  rect(ctx, 5, y + 8, 1, 5, DGREEN);
  rect(ctx, 27, y + 8, 1, 5, DGREEN);

  // Seat
  rect(ctx, 15, y + 5, 5, 3, SEAT);
  rect(ctx, 15, y + 4, 1, 1, SEAT);

  // Golf bag on back
  rect(ctx, 21, y + 2, 5, 6, BROWN);
  rect(ctx, 21, y + 2, 5, 1, LBROWN);
  // Club heads poking out
  rect(ctx, 22, y, 1, 3, GRAY);
  rect(ctx, 24, y - 1, 1, 4, GRAY);
  rect(ctx, 23, y + 1, 1, 2, GRAY);
  px(ctx, 22, y - 1, "#aaa");
  px(ctx, 24, y - 2, "#aaa");

  // Bottom line
  rect(ctx, 5, y + 14, 23, 1, BLACK);

  // Wheels
  rect(ctx, 7, y + 13, 5, 4, WHEEL);
  rect(ctx, 8, y + 14, 3, 2, GRAY);
  rect(ctx, 20, y + 13, 5, 4, WHEEL);
  rect(ctx, 21, y + 14, 3, 2, GRAY);
}

function drawCartLeft(ctx, bounceY = 0) {
  ctx.save();
  ctx.translate(32, 0);
  ctx.scale(-1, 1);
  drawCartRight(ctx, bounceY);
  ctx.restore();
}

function drawCartFront(ctx, bounceY = 0) {
  const y = 6 + bounceY;
  // Roof
  rect(ctx, 5, y, 22, 2, ROOF);
  rect(ctx, 6, y + 2, 1, 5, LGRAY);
  rect(ctx, 25, y + 2, 1, 5, LGRAY);

  // Windshield
  rect(ctx, 7, y + 2, 18, 5, GLASS);

  // Body
  rect(ctx, 4, y + 7, 24, 7, GREEN);

  // Headlights
  rect(ctx, 6, y + 8, 3, 2, "#ffe14d");
  rect(ctx, 23, y + 8, 3, 2, "#ffe14d");

  // Bumper
  rect(ctx, 5, y + 12, 22, 2, LGRAY);
  rect(ctx, 4, y + 14, 24, 1, BLACK);

  // Wheels
  rect(ctx, 4, y + 12, 3, 5, WHEEL);
  rect(ctx, 25, y + 12, 3, 5, WHEEL);
}

function drawCartBack(ctx, bounceY = 0) {
  const y = 6 + bounceY;
  // Roof
  rect(ctx, 5, y, 22, 2, ROOF);
  rect(ctx, 6, y + 2, 1, 5, LGRAY);
  rect(ctx, 25, y + 2, 1, 5, LGRAY);

  // Golf bag (visible from back, centered)
  rect(ctx, 10, y + 1, 12, 7, BROWN);
  rect(ctx, 10, y + 1, 12, 1, LBROWN);
  // Clubs poking up
  rect(ctx, 12, y - 2, 1, 4, GRAY);
  rect(ctx, 15, y - 3, 1, 5, GRAY);
  rect(ctx, 18, y - 1, 1, 3, GRAY);
  px(ctx, 12, y - 3, "#aaa");
  px(ctx, 15, y - 4, "#aaa");
  px(ctx, 18, y - 2, "#aaa");

  // Body
  rect(ctx, 4, y + 7, 24, 7, DGREEN);

  // Tail lights
  rect(ctx, 6, y + 8, 3, 2, "#c41e3a");
  rect(ctx, 23, y + 8, 3, 2, "#c41e3a");

  // Bumper
  rect(ctx, 5, y + 12, 22, 2, LGRAY);
  rect(ctx, 4, y + 14, 24, 1, BLACK);

  // Wheels
  rect(ctx, 4, y + 12, 3, 5, WHEEL);
  rect(ctx, 25, y + 12, 3, 5, WHEEL);
}

// Diagonal views: 3/4 perspective
function drawCartNE(ctx, bounceY = 0) {
  const y = 6 + bounceY;
  // Slightly angled - show right side + back corner
  rect(ctx, 8, y, 17, 2, ROOF);
  rect(ctx, 9, y + 2, 1, 5, LGRAY);
  rect(ctx, 23, y + 2, 1, 4, LGRAY);

  // Windshield (angled)
  rect(ctx, 10, y + 3, 4, 4, GLASS);

  // Body
  rect(ctx, 7, y + 7, 19, 7, GREEN);
  rect(ctx, 6, y + 8, 1, 5, DGREEN);

  // Golf bag
  rect(ctx, 20, y + 2, 4, 6, BROWN);
  rect(ctx, 21, y, 1, 3, GRAY);
  rect(ctx, 23, y - 1, 1, 3, GRAY);
  px(ctx, 21, y - 1, "#aaa");
  px(ctx, 23, y - 2, "#aaa");

  // Seat
  rect(ctx, 15, y + 5, 4, 3, SEAT);

  rect(ctx, 6, y + 14, 20, 1, BLACK);
  rect(ctx, 8, y + 13, 4, 4, WHEEL);
  rect(ctx, 9, y + 14, 2, 2, GRAY);
  rect(ctx, 20, y + 13, 4, 4, WHEEL);
  rect(ctx, 21, y + 14, 2, 2, GRAY);
}

function drawCartNW(ctx, bounceY = 0) {
  ctx.save();
  ctx.translate(32, 0);
  ctx.scale(-1, 1);
  drawCartNE(ctx, bounceY);
  ctx.restore();
}

function drawCartSE(ctx, bounceY = 0) {
  const y = 6 + bounceY;
  rect(ctx, 8, y, 17, 2, ROOF);
  rect(ctx, 9, y + 2, 1, 5, LGRAY);
  rect(ctx, 23, y + 2, 1, 4, LGRAY);

  // Windshield
  rect(ctx, 10, y + 3, 5, 4, GLASS);

  // Body
  rect(ctx, 7, y + 7, 19, 7, GREEN);

  // Headlight visible
  rect(ctx, 8, y + 8, 2, 2, "#ffe14d");

  // Golf bag (partially visible)
  rect(ctx, 20, y + 3, 4, 5, BROWN);
  rect(ctx, 21, y + 1, 1, 3, GRAY);
  px(ctx, 21, y, "#aaa");

  // Seat
  rect(ctx, 15, y + 5, 4, 3, SEAT);

  rect(ctx, 6, y + 14, 20, 1, BLACK);
  rect(ctx, 8, y + 13, 4, 4, WHEEL);
  rect(ctx, 9, y + 14, 2, 2, GRAY);
  rect(ctx, 20, y + 13, 4, 4, WHEEL);
  rect(ctx, 21, y + 14, 2, 2, GRAY);
}

function drawCartSW(ctx, bounceY = 0) {
  ctx.save();
  ctx.translate(32, 0);
  ctx.scale(-1, 1);
  drawCartSE(ctx, bounceY);
  ctx.restore();
}

function drawSleepingCart(ctx, frame) {
  drawCartRight(ctx, 2);
  ctx.fillStyle = "#555";
  ctx.font = "bold 7px monospace";
  if (frame === 0) {
    ctx.fillText("z", 14, 8);
  } else {
    ctx.fillText("z", 12, 10);
    ctx.fillText("z", 17, 5);
  }
}

function drawAlertCart(ctx) {
  drawCartRight(ctx, -2);
  ctx.fillStyle = "#c41e3a";
  ctx.font = "bold 9px monospace";
  ctx.fillText("!", 2, 12);
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

drawAt(...layout.idle[0], (c) => drawCartRight(c));
drawAt(...layout.alert[0], (c) => drawAlertCart(c));
drawAt(...layout.sleeping[0], (c) => drawSleepingCart(c, 0));
drawAt(...layout.sleeping[1], (c) => drawSleepingCart(c, 1));
drawAt(...layout.tired[0], (c) => drawCartRight(c, 1));
drawAt(...layout.scratch[0], (c) => drawCartRight(c, -1));
drawAt(...layout.scratch[1], (c) => drawCartRight(c, 1));
drawAt(...layout.scratch[2], (c) => drawCartRight(c, -1));

// Cardinal directions
drawAt(...layout.E[0], (c) => drawCartRight(c, 0));
drawAt(...layout.E[1], (c) => drawCartRight(c, -1));
drawAt(...layout.W[0], (c) => drawCartLeft(c, 0));
drawAt(...layout.W[1], (c) => drawCartLeft(c, -1));
drawAt(...layout.N[0], (c) => drawCartBack(c, 0));
drawAt(...layout.N[1], (c) => drawCartBack(c, -1));
drawAt(...layout.S[0], (c) => drawCartFront(c, 0));
drawAt(...layout.S[1], (c) => drawCartFront(c, -1));

// Diagonal directions
drawAt(...layout.NE[0], (c) => drawCartNE(c, 0));
drawAt(...layout.NE[1], (c) => drawCartNE(c, -1));
drawAt(...layout.NW[0], (c) => drawCartNW(c, 0));
drawAt(...layout.NW[1], (c) => drawCartNW(c, -1));
drawAt(...layout.SE[0], (c) => drawCartSE(c, 0));
drawAt(...layout.SE[1], (c) => drawCartSE(c, -1));
drawAt(...layout.SW[0], (c) => drawCartSW(c, 0));
drawAt(...layout.SW[1], (c) => drawCartSW(c, -1));

const out = "src/assets/sprites/golf-cart/sheet.png";
fs.mkdirSync("src/assets/sprites/golf-cart", { recursive: true });
fs.writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`wrote ${out}`);
