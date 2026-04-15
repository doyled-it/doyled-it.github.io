import { createCanvas } from "canvas";
import fs from "node:fs";

const SIZE = 16;

function newCanvas() {
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}
function px(ctx, x, y, color) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

function writeIcon(name, draw) {
  const { c, ctx } = newCanvas();
  draw(ctx);
  fs.mkdirSync("src/assets/sprites/nav", { recursive: true });
  fs.writeFileSync(`src/assets/sprites/nav/${name}.png`, c.toBuffer("image/png"));
  console.log(`wrote ${name}.png`);
}

const BLACK = "#1a1a1a";

// --- HOME: retro house ---
writeIcon("home", (ctx) => {
  // Roof
  rect(ctx, 7, 2, 2, 1, BLACK);
  rect(ctx, 5, 3, 6, 1, BLACK);
  rect(ctx, 3, 4, 10, 1, BLACK);
  // Roof fill
  rect(ctx, 7, 3, 2, 1, "#c41e3a");
  rect(ctx, 5, 4, 6, 1, "#c41e3a");
  // Walls outline
  rect(ctx, 3, 5, 1, 8, BLACK);
  rect(ctx, 12, 5, 1, 8, BLACK);
  rect(ctx, 3, 13, 10, 1, BLACK);
  // Wall fill
  rect(ctx, 4, 5, 8, 8, "#e8c48f");
  // Door
  rect(ctx, 7, 9, 2, 4, BLACK);
  rect(ctx, 7, 9, 2, 1, "#8B4513");
  rect(ctx, 7, 10, 2, 3, "#8B4513");
  px(ctx, 8, 11, "#ffe14d"); // doorknob
  // Windows
  rect(ctx, 5, 7, 2, 2, BLACK);
  px(ctx, 5, 7, "#87ceeb"); px(ctx, 6, 7, "#87ceeb");
  px(ctx, 5, 8, "#87ceeb"); px(ctx, 6, 8, "#87ceeb");
  rect(ctx, 9, 7, 2, 2, BLACK);
  px(ctx, 9, 7, "#87ceeb"); px(ctx, 10, 7, "#87ceeb");
  px(ctx, 9, 8, "#87ceeb"); px(ctx, 10, 8, "#87ceeb");
});

// --- RESUME: document with lines ---
writeIcon("resume", (ctx) => {
  // Outline
  rect(ctx, 3, 1, 10, 1, BLACK);
  rect(ctx, 3, 14, 10, 1, BLACK);
  rect(ctx, 3, 2, 1, 12, BLACK);
  rect(ctx, 12, 2, 1, 12, BLACK);
  // Paper fill
  rect(ctx, 4, 2, 8, 12, "#ffffff");
  // Corner fold
  rect(ctx, 10, 2, 2, 1, "#ddd");
  rect(ctx, 11, 3, 1, 1, "#ddd");
  px(ctx, 11, 2, BLACK);
  px(ctx, 12, 3, BLACK);
  // Text lines
  rect(ctx, 5, 4, 5, 1, "#555");
  rect(ctx, 5, 6, 6, 1, "#888");
  rect(ctx, 5, 7, 4, 1, "#888");
  rect(ctx, 5, 9, 6, 1, "#888");
  rect(ctx, 5, 10, 5, 1, "#888");
  rect(ctx, 5, 12, 4, 1, "#888");
});

// --- PROJECTS: gear/cog ---
writeIcon("projects", (ctx) => {
  // Teeth (8 directions)
  rect(ctx, 7, 1, 2, 2, BLACK);
  rect(ctx, 7, 13, 2, 2, BLACK);
  rect(ctx, 1, 7, 2, 2, BLACK);
  rect(ctx, 13, 7, 2, 2, BLACK);
  // Diagonal teeth
  rect(ctx, 3, 3, 2, 2, BLACK);
  rect(ctx, 11, 3, 2, 2, BLACK);
  rect(ctx, 3, 11, 2, 2, BLACK);
  rect(ctx, 11, 11, 2, 2, BLACK);
  // Body outline
  rect(ctx, 5, 3, 6, 1, BLACK);
  rect(ctx, 4, 4, 1, 1, BLACK);
  rect(ctx, 12, 4, 1, 1, BLACK);
  rect(ctx, 3, 5, 1, 6, BLACK);
  rect(ctx, 13, 5, 1, 6, BLACK);
  rect(ctx, 4, 11, 1, 1, BLACK);
  rect(ctx, 12, 11, 1, 1, BLACK);
  rect(ctx, 5, 12, 6, 1, BLACK);
  // Body fill
  rect(ctx, 5, 4, 6, 8, "#888");
  rect(ctx, 4, 5, 1, 6, "#888");
  rect(ctx, 12, 5, 1, 6, "#888");
  // Hole in middle
  rect(ctx, 7, 6, 2, 1, BLACK);
  rect(ctx, 6, 7, 4, 2, BLACK);
  rect(ctx, 7, 9, 2, 1, BLACK);
  rect(ctx, 7, 7, 2, 2, "#fffbe6");
  // Highlight
  rect(ctx, 5, 4, 2, 1, "#bbb");
});

// --- WORDS: book/pencil ---
writeIcon("words", (ctx) => {
  // Book outline
  rect(ctx, 3, 2, 10, 1, BLACK);
  rect(ctx, 3, 13, 10, 1, BLACK);
  rect(ctx, 3, 2, 1, 12, BLACK);
  rect(ctx, 12, 2, 1, 12, BLACK);
  // Spine
  rect(ctx, 7, 2, 1, 12, BLACK);
  // Pages fill
  rect(ctx, 4, 3, 3, 10, "#fffbe6");
  rect(ctx, 8, 3, 4, 10, "#fffbe6");
  // Text lines on pages
  rect(ctx, 5, 5, 2, 1, "#888");
  rect(ctx, 5, 7, 2, 1, "#888");
  rect(ctx, 5, 9, 2, 1, "#888");
  rect(ctx, 9, 5, 3, 1, "#888");
  rect(ctx, 9, 7, 3, 1, "#888");
  rect(ctx, 9, 9, 3, 1, "#888");
  rect(ctx, 9, 11, 2, 1, "#888");
});

// --- MUSIC: cassette tape ---
writeIcon("music", (ctx) => {
  // Body outline
  rect(ctx, 1, 3, 14, 1, BLACK);
  rect(ctx, 1, 12, 14, 1, BLACK);
  rect(ctx, 1, 4, 1, 8, BLACK);
  rect(ctx, 14, 4, 1, 8, BLACK);
  // Body fill
  rect(ctx, 2, 4, 12, 8, "#333");
  // Label area
  rect(ctx, 3, 5, 10, 3, "#fffbe6");
  // Reels (two holes)
  rect(ctx, 4, 8, 3, 3, "#e8c820");
  px(ctx, 5, 9, BLACK);
  rect(ctx, 9, 8, 3, 3, "#e8c820");
  px(ctx, 10, 9, BLACK);
  // Tape between reels
  rect(ctx, 7, 10, 2, 1, "#222");
});

// --- BASEBALL: classic ball ---
writeIcon("baseball", (ctx) => {
  // Outline circle
  rect(ctx, 6, 1, 4, 1, BLACK);
  rect(ctx, 4, 2, 2, 1, BLACK);
  rect(ctx, 10, 2, 2, 1, BLACK);
  rect(ctx, 3, 3, 1, 1, BLACK);
  rect(ctx, 12, 3, 1, 1, BLACK);
  rect(ctx, 2, 4, 1, 2, BLACK);
  rect(ctx, 13, 4, 1, 2, BLACK);
  rect(ctx, 1, 6, 1, 4, BLACK);
  rect(ctx, 14, 6, 1, 4, BLACK);
  rect(ctx, 2, 10, 1, 2, BLACK);
  rect(ctx, 13, 10, 1, 2, BLACK);
  rect(ctx, 3, 12, 1, 1, BLACK);
  rect(ctx, 12, 12, 1, 1, BLACK);
  rect(ctx, 4, 13, 2, 1, BLACK);
  rect(ctx, 10, 13, 2, 1, BLACK);
  rect(ctx, 6, 14, 4, 1, BLACK);
  // Fill
  rect(ctx, 6, 2, 4, 1, "#fff");
  rect(ctx, 4, 3, 8, 1, "#fff");
  rect(ctx, 3, 4, 10, 2, "#fff");
  rect(ctx, 2, 6, 12, 4, "#fff");
  rect(ctx, 3, 10, 10, 2, "#fff");
  rect(ctx, 4, 12, 8, 1, "#fff");
  rect(ctx, 6, 13, 4, 1, "#fff");
  // Stitches (two vertical curves)
  px(ctx, 5, 4, "#c41e3a");
  px(ctx, 4, 5, "#c41e3a"); px(ctx, 5, 5, "#c41e3a");
  px(ctx, 4, 6, "#c41e3a");
  px(ctx, 4, 7, "#c41e3a");
  px(ctx, 4, 8, "#c41e3a");
  px(ctx, 4, 9, "#c41e3a");
  px(ctx, 4, 10, "#c41e3a"); px(ctx, 5, 10, "#c41e3a");
  px(ctx, 5, 11, "#c41e3a");
  // Right stitch
  px(ctx, 10, 4, "#c41e3a");
  px(ctx, 10, 5, "#c41e3a"); px(ctx, 11, 5, "#c41e3a");
  px(ctx, 11, 6, "#c41e3a");
  px(ctx, 11, 7, "#c41e3a");
  px(ctx, 11, 8, "#c41e3a");
  px(ctx, 11, 9, "#c41e3a");
  px(ctx, 10, 10, "#c41e3a"); px(ctx, 11, 10, "#c41e3a");
  px(ctx, 10, 11, "#c41e3a");
});

// --- GOLF: flagstick in hole ---
writeIcon("golf", (ctx) => {
  // Grass base
  rect(ctx, 0, 13, 16, 3, "#228b22");
  rect(ctx, 0, 12, 16, 1, "#4caf50");
  // Hole
  rect(ctx, 7, 11, 3, 2, BLACK);
  // Flagstick
  rect(ctx, 8, 2, 1, 10, BLACK);
  px(ctx, 7, 2, BLACK);
  // Flag
  rect(ctx, 9, 2, 4, 1, BLACK);
  rect(ctx, 9, 5, 4, 1, BLACK);
  rect(ctx, 9, 3, 4, 2, "#c41e3a");
  rect(ctx, 12, 3, 1, 2, "#8a0e25");
  // Grass tufts
  px(ctx, 2, 11, "#228b22");
  px(ctx, 4, 11, "#228b22");
  px(ctx, 12, 11, "#228b22");
  px(ctx, 14, 11, "#228b22");
});

// --- CONTACT: envelope ---
writeIcon("contact", (ctx) => {
  // Outline
  rect(ctx, 1, 3, 14, 1, BLACK);
  rect(ctx, 1, 13, 14, 1, BLACK);
  rect(ctx, 1, 4, 1, 9, BLACK);
  rect(ctx, 14, 4, 1, 9, BLACK);
  // Fill
  rect(ctx, 2, 4, 12, 9, "#ffffff");
  // Flap triangle (lines from corners to middle top)
  px(ctx, 2, 4, BLACK);
  px(ctx, 3, 5, BLACK);
  px(ctx, 4, 6, BLACK);
  px(ctx, 5, 7, BLACK);
  px(ctx, 6, 8, BLACK);
  px(ctx, 7, 8, BLACK); // middle meeting
  px(ctx, 8, 8, BLACK);
  px(ctx, 9, 7, BLACK);
  px(ctx, 10, 6, BLACK);
  px(ctx, 11, 5, BLACK);
  px(ctx, 12, 4, BLACK);
  px(ctx, 13, 4, BLACK);
  // Flap shading
  rect(ctx, 3, 4, 10, 1, "#f0f0f0");
});
