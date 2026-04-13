import { createCanvas } from "canvas";
import fs from "node:fs";

const SIZE = 32;
const COLS = 8;
const ROWS = 4;
const canvas = createCanvas(SIZE * COLS, SIZE * ROWS);
const ctx = canvas.getContext("2d");

function clear() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawAt(col, row, drawFn) {
  ctx.save();
  ctx.translate(col * SIZE, row * SIZE);
  drawFn(ctx);
  ctx.restore();
}

function drawBall(ctx, rotation = 0, squash = 1, offsetX = 0, offsetY = 0) {
  const cx = 16 + offsetX;
  const cy = 16 + offsetY;
  const r = 10;

  // Ball body
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * squash, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball outline
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * squash, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Red stitching - two curved lines that rotate
  ctx.strokeStyle = "#c41e3a";
  ctx.lineWidth = 1.5;

  const angle = rotation * Math.PI / 180;

  // Left stitch curve
  ctx.beginPath();
  for (let i = -6; i <= 6; i++) {
    const t = i / 6;
    const sx = cx + Math.cos(angle) * t * 6 - Math.sin(angle) * (Math.sin(t * Math.PI) * 4);
    const sy = cy + Math.sin(angle) * t * 6 + Math.cos(angle) * (Math.sin(t * Math.PI) * 4);
    if (i === -6) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Right stitch curve
  ctx.beginPath();
  for (let i = -6; i <= 6; i++) {
    const t = i / 6;
    const sx = cx + Math.cos(angle) * t * 6 + Math.sin(angle) * (Math.sin(t * Math.PI) * 4);
    const sy = cy + Math.sin(angle) * t * 6 - Math.cos(angle) * (Math.sin(t * Math.PI) * 4);
    if (i === -6) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Stitch marks (small perpendicular lines)
  ctx.strokeStyle = "#c41e3a";
  ctx.lineWidth = 0.8;
  for (let i = -5; i <= 5; i += 2) {
    const t = i / 6;
    // Left curve stitches
    const lx = cx + Math.cos(angle) * t * 6 - Math.sin(angle) * (Math.sin(t * Math.PI) * 4);
    const ly = cy + Math.sin(angle) * t * 6 + Math.cos(angle) * (Math.sin(t * Math.PI) * 4);
    ctx.beginPath();
    ctx.moveTo(lx - 1, ly - 1);
    ctx.lineTo(lx + 1, ly + 1);
    ctx.stroke();
  }
}

function drawSleepingBall(ctx, frame) {
  drawBall(ctx, 0, 0.85, 0, 3);

  // Zzz
  ctx.fillStyle = "#555";
  ctx.font = "bold 8px monospace";
  const zOffsets = frame === 0 ? [[20, 8]] : [[18, 10], [22, 5]];
  for (const [zx, zy] of zOffsets) {
    ctx.fillText("z", zx, zy);
  }
}

function drawAlertBall(ctx) {
  drawBall(ctx, 0, 1, 0, -2);
  // Exclamation
  ctx.fillStyle = "#c41e3a";
  ctx.font = "bold 10px monospace";
  ctx.fillText("!", 22, 10);
}

function drawIdleBall(ctx) {
  drawBall(ctx, 0, 1, 0, 0);
  // Small shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(16, 28, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMovingBall(ctx, dir, frame) {
  const bounce = frame === 0 ? -2 : 0;
  const rot = frame === 0 ? 0 : 45;
  let ox = 0, oy = 0;

  if (dir.includes("N")) oy = -2;
  if (dir.includes("S")) oy = 2;
  if (dir.includes("E")) ox = 2;
  if (dir.includes("W")) ox = -2;

  // Motion trail
  ctx.fillStyle = "rgba(200,200,200,0.3)";
  ctx.beginPath();
  ctx.ellipse(16 - ox * 2, 16 - oy * 2 - bounce, 6, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  drawBall(ctx, rot + (dir === "E" || dir === "NE" || dir === "SE" ? 30 : 0)
    + (dir === "W" || dir === "NW" || dir === "SW" ? -30 : 0),
    1, ox, bounce + oy);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.beginPath();
  ctx.ellipse(16 + ox, 28, 7, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Sprite sheet layout (matching oneko format):
// Row 0: NW0, NW1, sleep0, sleep1, E0, E1, scratch0, scratch1
// Row 1: W0, W1, sleep(alt), tired, SE0, SE1, scratch2, SW1
// Row 2: N0, N1, NE0, NE1, idle(alt), W(alt), S1, alert(alt)
// Row 3: S0, NE(alt), SE(alt), idle, SW0, SW(alt), S(alt), alert

// Using the frame coordinate system from manifest.json:
// idle:     [-3, -3]
// alert:    [-7, -3]
// sleeping: [-2, 0], [-2, -1]
// N:        [-1, -2], [-1, -3]
// NE:       [0, -2], [0, -3]
// E:        [-3, 0], [-3, -1]
// SE:       [-5, -1], [-5, -2]
// S:        [-6, -3], [-7, -2]
// SW:       [-5, -3], [-6, -1]
// W:        [-4, -2], [-4, -3]
// NW:       [-1, 0], [-1, -1]

// Convert negative offsets to positive col/row:
// [-col, -row] means tile at (abs(col), abs(row))

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

clear();

// Idle
drawAt(...layout.idle[0], (c) => drawIdleBall(c));

// Alert
drawAt(...layout.alert[0], (c) => drawAlertBall(c));

// Sleeping frames
drawAt(...layout.sleeping[0], (c) => drawSleepingBall(c, 0));
drawAt(...layout.sleeping[1], (c) => drawSleepingBall(c, 1));

// Tired
drawAt(...layout.tired[0], (c) => {
  drawBall(c, 0, 0.9, 0, 1);
});

// Scratch (ball spinning in place)
drawAt(...layout.scratch[0], (c) => drawBall(c, 0));
drawAt(...layout.scratch[1], (c) => drawBall(c, 30));
drawAt(...layout.scratch[2], (c) => drawBall(c, 60));

// Directional movement
for (const dir of ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]) {
  for (let f = 0; f < layout[dir].length; f++) {
    drawAt(...layout[dir][f], (c) => drawMovingBall(c, dir, f));
  }
}

const out = "src/assets/sprites/baseball/sheet.png";
fs.mkdirSync("src/assets/sprites/baseball", { recursive: true });
fs.writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`wrote ${out}`);
