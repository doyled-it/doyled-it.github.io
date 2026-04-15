import { createCanvas } from "canvas";
import fs from "node:fs";

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// ===========================================================================
// Golf green with flagstick — small mound, hole, pin with waving flag
// 20w x 40h canvas, 4 frames (flag animation only)
// ===========================================================================
{
  const FRAMES = 4;
  const W = 20, H = 40;
  const c = createCanvas(W * FRAMES, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const GREEN = "#4caf50";
  const GREEN_D = "#2d7a32";
  const GREEN_L = "#7ed981";
  const EARTH = "#6b4423";
  const PIN = "#eeeeee";
  const PIN_D = "#888888";
  const HOLE = "#111";
  const FLAG = "#c41e3a";
  const FLAG_D = "#8a0e25";
  const OUTLINE = "#1a1a1a";

  // Flag flutter patterns (5 wide, 3 tall triangular pennant)
  const flags = [
    // frame 0 — extended right
    [
      "FFFFF",
      "FFFF.",
      "FFF..",
    ],
    // frame 1 — wavy
    [
      ".FFFF",
      "FFFFF",
      "FFF..",
    ],
    // frame 2 — ruffle
    [
      "FFFF.",
      "FFFF.",
      "FFFFF",
    ],
    // frame 3 — mid-wave
    [
      "FFFFF",
      "FFF..",
      "FFFF.",
    ],
  ];
  const fmap = { ".": null, F: FLAG, D: FLAG_D };

  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * W, 0);

    // === Mound (bottom of sprite) — shallow, wide profile with dark outline ===
    // Outline: step along the mound edge
    rect(ctx, 0, 35, 1, 5, OUTLINE);     // left side
    rect(ctx, 19, 35, 1, 5, OUTLINE);    // right side
    rect(ctx, 1, 33, 1, 2, OUTLINE);
    rect(ctx, 18, 33, 1, 2, OUTLINE);
    rect(ctx, 2, 31, 1, 2, OUTLINE);
    rect(ctx, 17, 31, 1, 2, OUTLINE);
    rect(ctx, 3, 30, 14, 1, OUTLINE);    // top

    // Base rows
    rect(ctx, 1, 36, 18, 4, GREEN);
    rect(ctx, 2, 34, 16, 2, GREEN);
    rect(ctx, 3, 32, 14, 2, GREEN);
    rect(ctx, 3, 31, 14, 1, GREEN);
    // Top highlight
    rect(ctx, 4, 31, 12, 1, GREEN_L);
    // Subtle shadow on right
    rect(ctx, 15, 33, 2, 3, GREEN_D);
    rect(ctx, 17, 36, 1, 4, GREEN_D);
    // Grass tufts (with tiny outline)
    px(ctx, 5, 29, OUTLINE);
    px(ctx, 5, 30, GREEN);
    px(ctx, 9, 29, OUTLINE);
    px(ctx, 9, 30, GREEN);
    px(ctx, 12, 29, OUTLINE);
    px(ctx, 12, 30, GREEN);
    px(ctx, 15, 29, OUTLINE);
    px(ctx, 15, 30, GREEN);

    // === Hole on top of mound ===
    rect(ctx, 8, 31, 3, 1, HOLE);
    px(ctx, 7, 31, GREEN_D);

    // === Flagstick (pin) rising from hole — with outline ===
    // Outline columns flanking the pin
    rect(ctx, 8, 8, 1, 23, OUTLINE);
    rect(ctx, 10, 8, 1, 23, OUTLINE);
    // Pin body
    rect(ctx, 9, 8, 1, 23, PIN);
    // Tiny point on top of pin with outline
    px(ctx, 8, 7, OUTLINE);
    px(ctx, 10, 7, OUTLINE);
    px(ctx, 9, 6, OUTLINE);
    px(ctx, 9, 7, PIN);

    // === Flag at top of pin — with outline ===
    const pattern = flags[f];
    // Draw outline first
    for (let y = 0; y < pattern.length; y++) {
      for (let x = 0; x < pattern[y].length; x++) {
        if (fmap[pattern[y][x]]) {
          px(ctx, 10 + x, 8 + y - 1, OUTLINE);
          px(ctx, 10 + x, 8 + y + 1, OUTLINE);
          px(ctx, 10 + x - 1, 8 + y, OUTLINE);
          px(ctx, 10 + x + 1, 8 + y, OUTLINE);
        }
      }
    }
    // Then flag body
    for (let y = 0; y < pattern.length; y++) {
      for (let x = 0; x < pattern[y].length; x++) {
        const col = fmap[pattern[y][x]];
        if (col) px(ctx, 10 + x, 8 + y, col);
      }
    }
    // Bottom shadow of flag
    for (let x = 0; x < 5; x++) {
      if (fmap[pattern[2][x]]) px(ctx, 10 + x, 11, FLAG_D);
    }

    ctx.restore();
  }

  fs.mkdirSync("src/assets/sprites/scenes", { recursive: true });
  fs.writeFileSync("src/assets/sprites/scenes/golf-green.png", c.toBuffer("image/png"));
  console.log("wrote golf-green.png", `${W * FRAMES}x${H}`, `${FRAMES} frames`);
}
