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

const WHITE = "#fff";
const GREEN = "#228b22";
const DGREEN = "#1a6b1a";
const BLACK = "#222";
const GRAY = "#888";
const LGRAY = "#ccc";
const WHEEL = "#333";
const ROOF = "#e8e8e8";

function drawCartSide(ctx, flip = false, bounceY = 0) {
  ctx.save();
  if (flip) {
    ctx.translate(32, 0);
    ctx.scale(-1, 1);
  }

  const y = 8 + bounceY;

  // Roof
  rect(ctx, 8, y, 18, 2, ROOF);
  rect(ctx, 7, y + 1, 1, 1, LGRAY);
  rect(ctx, 26, y + 1, 1, 1, LGRAY);

  // Roof posts
  rect(ctx, 9, y + 2, 1, 6, LGRAY);
  rect(ctx, 24, y + 2, 1, 4, LGRAY);

  // Body
  rect(ctx, 6, y + 8, 22, 8, GREEN);
  rect(ctx, 5, y + 9, 1, 6, DGREEN);
  rect(ctx, 28, y + 9, 1, 6, DGREEN);

  // Windshield
  rect(ctx, 10, y + 4, 6, 5, "rgba(135,206,235,0.7)");
  rect(ctx, 10, y + 4, 6, 1, "#87ceeb");

  // Seat
  rect(ctx, 17, y + 6, 6, 3, "#8B4513");
  rect(ctx, 17, y + 5, 1, 1, "#8B4513");

  // Rear cargo
  rect(ctx, 22, y + 8, 5, 5, DGREEN);

  // Outline accents
  rect(ctx, 6, y + 16, 22, 1, BLACK);

  // Wheels
  rect(ctx, 8, y + 15, 4, 4, WHEEL);
  rect(ctx, 9, y + 16, 2, 2, GRAY);
  rect(ctx, 21, y + 15, 4, 4, WHEEL);
  rect(ctx, 22, y + 16, 2, 2, GRAY);

  // Flag on back
  rect(ctx, 26, y + 2, 1, 7, "#8B4513");
  rect(ctx, 27, y + 2, 4, 3, "#ff4444");

  ctx.restore();
}

function drawCartFront(ctx, bounceY = 0) {
  const y = 8 + bounceY;

  // Roof (wider, head-on)
  rect(ctx, 6, y, 20, 2, ROOF);

  // Roof posts
  rect(ctx, 7, y + 2, 1, 6, LGRAY);
  rect(ctx, 24, y + 2, 1, 6, LGRAY);

  // Windshield
  rect(ctx, 8, y + 3, 16, 5, "rgba(135,206,235,0.7)");
  rect(ctx, 8, y + 3, 16, 1, "#87ceeb");

  // Body
  rect(ctx, 5, y + 8, 22, 8, GREEN);

  // Headlights
  rect(ctx, 7, y + 9, 3, 2, "#ffe14d");
  rect(ctx, 22, y + 9, 3, 2, "#ffe14d");

  // Bumper
  rect(ctx, 6, y + 14, 20, 2, LGRAY);
  rect(ctx, 5, y + 16, 22, 1, BLACK);

  // Wheels (showing edges)
  rect(ctx, 5, y + 14, 3, 5, WHEEL);
  rect(ctx, 24, y + 14, 3, 5, WHEEL);
}

function drawCartBack(ctx, bounceY = 0) {
  const y = 8 + bounceY;

  // Roof
  rect(ctx, 6, y, 20, 2, ROOF);

  // Posts
  rect(ctx, 7, y + 2, 1, 6, LGRAY);
  rect(ctx, 24, y + 2, 1, 6, LGRAY);

  // Rear body
  rect(ctx, 5, y + 8, 22, 8, DGREEN);

  // Tail lights
  rect(ctx, 7, y + 9, 3, 2, "#c41e3a");
  rect(ctx, 22, y + 9, 3, 2, "#c41e3a");

  // Cargo area
  rect(ctx, 8, y + 6, 16, 3, GREEN);

  // Clubs sticking out
  rect(ctx, 12, y + 1, 1, 6, "#8B4513");
  rect(ctx, 15, y + 2, 1, 5, "#8B4513");
  rect(ctx, 18, y + 0, 1, 7, "#8B4513");
  rect(ctx, 12, y, 1, 2, GRAY);
  rect(ctx, 15, y + 1, 1, 2, GRAY);
  rect(ctx, 18, y - 1, 1, 2, GRAY);

  // Bumper
  rect(ctx, 6, y + 14, 20, 2, LGRAY);
  rect(ctx, 5, y + 16, 22, 1, BLACK);

  // Wheels
  rect(ctx, 5, y + 14, 3, 5, WHEEL);
  rect(ctx, 24, y + 14, 3, 5, WHEEL);
}

function drawSleepingCart(ctx, frame) {
  drawCartSide(ctx, false, 2);
  ctx.fillStyle = "#555";
  ctx.font = "bold 8px monospace";
  if (frame === 0) {
    ctx.fillText("z", 20, 9);
  } else {
    ctx.fillText("z", 18, 11);
    ctx.fillText("z", 23, 7);
  }
}

function drawAlertCart(ctx) {
  drawCartSide(ctx, false, -2);
  ctx.fillStyle = "#c41e3a";
  ctx.font = "bold 10px monospace";
  ctx.fillText("!", 2, 12);
}

function drawIdleCart(ctx) {
  drawCartSide(ctx, false, 0);
}

// Layout matches oneko manifest coordinates
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

// Idle
drawAt(...layout.idle[0], (c) => drawIdleCart(c));

// Alert
drawAt(...layout.alert[0], (c) => drawAlertCart(c));

// Sleeping
drawAt(...layout.sleeping[0], (c) => drawSleepingCart(c, 0));
drawAt(...layout.sleeping[1], (c) => drawSleepingCart(c, 1));

// Tired
drawAt(...layout.tired[0], (c) => drawCartSide(c, false, 1));

// Scratch (cart rocking)
drawAt(...layout.scratch[0], (c) => drawCartSide(c, false, -1));
drawAt(...layout.scratch[1], (c) => drawCartSide(c, false, 1));
drawAt(...layout.scratch[2], (c) => drawCartSide(c, false, -1));

// E - facing right (side view)
drawAt(...layout.E[0], (c) => drawCartSide(c, false, 0));
drawAt(...layout.E[1], (c) => drawCartSide(c, false, -1));

// W - facing left (flipped side)
drawAt(...layout.W[0], (c) => drawCartSide(c, true, 0));
drawAt(...layout.W[1], (c) => drawCartSide(c, true, -1));

// N - facing away (back view)
drawAt(...layout.N[0], (c) => drawCartBack(c, 0));
drawAt(...layout.N[1], (c) => drawCartBack(c, -1));

// S - facing toward (front view)
drawAt(...layout.S[0], (c) => drawCartFront(c, 0));
drawAt(...layout.S[1], (c) => drawCartFront(c, -1));

// NE - angled right-side + back elements
drawAt(...layout.NE[0], (c) => drawCartSide(c, false, 0));
drawAt(...layout.NE[1], (c) => drawCartSide(c, false, -1));

// NW - angled left-side + back elements
drawAt(...layout.NW[0], (c) => drawCartSide(c, true, 0));
drawAt(...layout.NW[1], (c) => drawCartSide(c, true, -1));

// SE - angled right-side + front elements
drawAt(...layout.SE[0], (c) => drawCartSide(c, false, 0));
drawAt(...layout.SE[1], (c) => drawCartSide(c, false, -1));

// SW - angled left-side + front elements
drawAt(...layout.SW[0], (c) => drawCartSide(c, true, 0));
drawAt(...layout.SW[1], (c) => drawCartSide(c, true, -1));

const out = "src/assets/sprites/golf-cart/sheet.png";
fs.mkdirSync("src/assets/sprites/golf-cart", { recursive: true });
fs.writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`wrote ${out}`);
