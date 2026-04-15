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

    // === Mound (bottom of sprite) ===
    // Mound is roughly pyramidal, 20px wide at base tapering up
    // Base row (y=37-39): full width green
    rect(ctx, 1, 37, 18, 3, GREEN);
    // Row y=34-36: narrower
    rect(ctx, 2, 34, 16, 3, GREEN);
    // Row y=31-33: narrower
    rect(ctx, 3, 31, 14, 3, GREEN);
    // Row y=28-30: top of mound
    rect(ctx, 4, 28, 12, 3, GREEN);
    // Top highlight
    rect(ctx, 5, 28, 10, 1, GREEN_L);
    // Mound shadow (right side)
    rect(ctx, 14, 31, 3, 3, GREEN_D);
    rect(ctx, 16, 34, 2, 3, GREEN_D);
    rect(ctx, 17, 37, 2, 3, GREEN_D);
    // Grass tufts on top
    px(ctx, 6, 27, GREEN);
    px(ctx, 10, 27, GREEN);
    px(ctx, 13, 27, GREEN);

    // === Hole on top of mound ===
    rect(ctx, 8, 28, 3, 1, HOLE);
    px(ctx, 7, 28, GREEN_D);

    // === Flagstick (pin) rising from hole ===
    rect(ctx, 9, 8, 1, 20, PIN);
    px(ctx, 10, 8, PIN_D);           // shadow on pole
    px(ctx, 10, 14, PIN_D);
    px(ctx, 10, 20, PIN_D);
    // Pin base (where it meets the green)
    rect(ctx, 8, 28, 3, 1, HOLE);    // hole darkness
    // Tiny point on top of pin
    px(ctx, 9, 7, PIN);

    // === Flag at top of pin ===
    const pattern = flags[f];
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
