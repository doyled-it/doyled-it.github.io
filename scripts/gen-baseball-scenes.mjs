import { createCanvas } from "canvas";
import fs from "node:fs";

// Pixel-art scene sprite generator for the baseball page.
// Each scene is a horizontal strip of frames at 32x32 each.

function makeCanvas(cols, rows = 1) {
  const c = createCanvas(32 * cols, 32 * rows);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// Colors
const SKIN = "#f4c187";
const SHIRT = "#ffffff";
const SHIRT_D = "#dddddd";
const PANTS = "#888888";
const CAP = "#c41e3a";
const GLOVE = "#8B4513";
const BAT = "#a06030";
const BAT_D = "#6f3f1c";
const BALL = "#ffffff";
const STITCH = "#c41e3a";
const BLACK = "#222";
const SHADOW = "rgba(0,0,0,0.15)";

// --- Tiny player (facing right, 10w x 14h starting at ox, oy) ---
function drawPlayer(ctx, ox, oy, armFrame = 0, hasGlove = true, facingRight = true) {
  ctx.save();
  if (!facingRight) {
    ctx.translate(ox * 2 + 10, 0);
    ctx.scale(-1, 1);
  }

  // Cap
  rect(ctx, ox + 3, oy + 0, 5, 2, CAP);
  rect(ctx, ox + 2, oy + 1, 1, 1, CAP);
  rect(ctx, ox + 7, oy + 1, 1, 1, CAP); // cap bill
  // Head
  rect(ctx, ox + 3, oy + 2, 4, 3, SKIN);
  px(ctx, ox + 4, oy + 3, BLACK);
  // Body
  rect(ctx, ox + 3, oy + 5, 4, 4, SHIRT);
  rect(ctx, ox + 3, oy + 5, 1, 4, SHIRT_D);
  // Arms (depend on frame)
  if (armFrame === 0) {
    // Arms down, glove at hip
    rect(ctx, ox + 2, oy + 6, 1, 2, SHIRT);
    rect(ctx, ox + 7, oy + 6, 1, 2, SHIRT);
    if (hasGlove) rect(ctx, ox + 7, oy + 8, 2, 2, GLOVE);
  } else if (armFrame === 1) {
    // One arm raised (throwing wind-up)
    rect(ctx, ox + 1, oy + 4, 2, 2, SHIRT);
    rect(ctx, ox + 7, oy + 6, 1, 2, SHIRT);
    if (hasGlove) rect(ctx, ox + 0, oy + 3, 2, 2, GLOVE);
  } else if (armFrame === 2) {
    // Both arms forward (catch / throw release)
    rect(ctx, ox + 7, oy + 5, 2, 2, SHIRT);
    rect(ctx, ox + 2, oy + 6, 1, 2, SHIRT);
    if (hasGlove) rect(ctx, ox + 8, oy + 5, 2, 2, GLOVE);
  }
  // Pants
  rect(ctx, ox + 3, oy + 9, 4, 3, PANTS);
  // Legs
  rect(ctx, ox + 3, oy + 12, 1, 2, PANTS);
  rect(ctx, ox + 6, oy + 12, 1, 2, PANTS);

  ctx.restore();
}

// --- Ball (4x4 centered around x,y) ---
function drawBall(ctx, x, y) {
  rect(ctx, x - 1, y - 1, 3, 3, BALL);
  px(ctx, x, y - 1, STITCH);
  px(ctx, x, y + 1, STITCH);
  px(ctx, x - 1, y, BLACK);
  px(ctx, x + 2, y, BLACK);
}

// ===========================================================================
// Scene 1: Two players ONLY (no ball) — meant to flank the name/header,
// standing on the bottom border. Output is just two small player sprites.
// The ball animation runs separately across the middle via JS.
// Separate sprites so the ball can fly independently.
// ===========================================================================

// Left player (facing right): 3 frames — ready, wind-up, release
{
  const FRAMES = 3;
  const W = 14, H = 16;
  const c = createCanvas(W * FRAMES, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const arms = [0, 1, 2]; // ready, wind-up, release
  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * W, 0);
    drawPlayer(ctx, 2, 1, arms[f], true, true);
    ctx.restore();
  }
  fs.mkdirSync("src/assets/sprites/scenes", { recursive: true });
  fs.writeFileSync("src/assets/sprites/scenes/player-left.png", c.toBuffer("image/png"));
  console.log("wrote player-left.png", `${W * FRAMES}x${H}`, `${FRAMES} frames`);
}

// Right player: reuse left sprite but with different frames — CSS flips it visually
{
  const FRAMES = 3;
  const W = 14, H = 16;
  const c = createCanvas(W * FRAMES, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const arms = [0, 2, 1]; // ready, reach-to-catch, wind-up-to-throw-back
  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * W, 0);
    drawPlayer(ctx, 2, 1, arms[f], true, true); // always drawn facing right
    ctx.restore();
  }
  fs.writeFileSync("src/assets/sprites/scenes/player-right.png", c.toBuffer("image/png"));
  console.log("wrote player-right.png", `${W * FRAMES}x${H}`, `${FRAMES} frames`);
}

// Floating ball (single 8x8 frame for use with CSS animation)
{
  const W = 8, H = 8;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  // Small baseball centered
  rect(ctx, 1, 1, 6, 6, BALL);
  rect(ctx, 0, 2, 1, 4, BLACK);
  rect(ctx, 7, 2, 1, 4, BLACK);
  rect(ctx, 2, 0, 4, 1, BLACK);
  rect(ctx, 2, 7, 4, 1, BLACK);
  // Stitches
  px(ctx, 2, 2, STITCH);
  px(ctx, 5, 2, STITCH);
  px(ctx, 2, 5, STITCH);
  px(ctx, 5, 5, STITCH);
  fs.writeFileSync("src/assets/sprites/scenes/ball-small.png", c.toBuffer("image/png"));
  console.log("wrote ball-small.png", `${W}x${H}`);
}

// ===========================================================================
// Scene 2: Pitcher throws, batter hits, ball flies off
// 96x32 canvas, 8 frames
// ===========================================================================
{
  const FRAMES = 8;
  const W = 96, H = 32;
  const c = createCanvas(W * FRAMES, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // Pitcher at x=10, batter at x=80
  // Frame 0: pitcher wind-up
  // Frame 1: pitcher releases ball
  // Frame 2-3: ball traveling
  // Frame 4: batter swings, contact
  // Frame 5-7: ball flies up-right and off screen
  const pitcherArm = [1, 2, 0, 0, 0, 0, 0, 0];
  const batterPose = [0, 0, 0, 0, 1, 0, 0, 0];
  const ballX =      [14, 22, 36, 52, 72, 88, 110, 130];
  const ballY =      [12, 12, 13, 13, 12, 6,  -4,  -20];
  const showBall =   [true, true, true, true, true, true, true, false];

  // Draw batter (small custom since he holds a bat)
  function drawBatter(ctx, ox, oy, swing = false) {
    // Facing left (ball comes from left, bat swings right-to-left across body)
    ctx.save();
    ctx.translate(ox + 10, oy);
    ctx.scale(-1, 1);
    ox = 0; oy = 0;

    // Cap
    rect(ctx, ox + 3, oy + 0, 5, 2, CAP);
    rect(ctx, ox + 7, oy + 1, 1, 1, CAP);
    // Head
    rect(ctx, ox + 3, oy + 2, 4, 3, SKIN);
    px(ctx, ox + 5, oy + 3, BLACK);
    // Body
    rect(ctx, ox + 3, oy + 5, 4, 4, SHIRT);
    rect(ctx, ox + 3, oy + 5, 1, 4, SHIRT_D);

    if (!swing) {
      // Bat cocked back (over shoulder)
      rect(ctx, ox + 1, oy + 4, 2, 2, SHIRT); // arms back
      rect(ctx, ox + 0, oy + 0, 1, 5, BAT);
      rect(ctx, ox + 1, oy + 0, 1, 4, BAT_D);
    } else {
      // Swing - bat extended forward horizontally
      rect(ctx, ox + 7, oy + 5, 3, 2, SHIRT); // arms forward
      rect(ctx, ox + 10, oy + 5, 6, 1, BAT);
      rect(ctx, ox + 10, oy + 6, 6, 1, BAT_D);
    }

    // Pants
    rect(ctx, ox + 3, oy + 9, 4, 3, PANTS);
    rect(ctx, ox + 3, oy + 12, 1, 2, PANTS);
    rect(ctx, ox + 6, oy + 12, 1, 2, PANTS);
    ctx.restore();
  }

  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * W, 0);

    // Ground
    rect(ctx, 0, 28, W, 1, "rgba(0,0,0,0.15)");

    // Home plate
    rect(ctx, 80, 27, 5, 1, "#fff");

    // Pitcher's mound (little hill)
    rect(ctx, 8, 26, 14, 2, "#c9a76f");

    // Pitcher
    drawPlayer(ctx, 10, 14, pitcherArm[f], true, true);
    rect(ctx, 12, 28, 6, 1, SHADOW);

    // Batter
    drawBatter(ctx, 78, 14, batterPose[f] === 1);
    rect(ctx, 80, 28, 6, 1, SHADOW);

    // Ball
    if (showBall[f]) {
      drawBall(ctx, ballX[f], ballY[f]);
    }

    ctx.restore();
  }

  fs.writeFileSync("src/assets/sprites/scenes/baseball-pitch.png", c.toBuffer("image/png"));
  console.log("wrote baseball-pitch.png", `${W * FRAMES}x${H}`, `${FRAMES} frames`);
}

// ===========================================================================
// Scene 3: Waving flag (small accent animation)
// 16x20 canvas, 4 frames
// ===========================================================================
{
  const FRAMES = 4;
  const W = 16, H = 20;
  const c = createCanvas(W * FRAMES, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const waves = [
    // frame 0
    [
      "PPPPP.",
      "PRRRRP",
      "PRRRR.",
      "PRRRRP",
      "PPPPP.",
    ],
    // frame 1
    [
      ".PPPPP",
      "PRRRRR",
      "PRRRR.",
      "PRRRRR",
      ".PPPPP",
    ],
    // frame 2
    [
      "PPPPP.",
      "PRRRR.",
      "PRRRRP",
      "PRRRR.",
      "PPPPP.",
    ],
    // frame 3
    [
      ".PPPPP",
      "PRRRR.",
      "PRRRRR",
      "PRRRR.",
      ".PPPPP",
    ],
  ];

  const cmap = { ".": null, P: "#c41e3a", R: "#c41e3a" };

  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * W, 0);

    // Pole
    rect(ctx, 2, 2, 1, 18, "#b0b0b0");
    px(ctx, 1, 1, "#ffe14d");
    px(ctx, 2, 0, "#ffe14d");
    px(ctx, 3, 1, "#ffe14d");

    // Flag
    const pattern = waves[f];
    for (let y = 0; y < pattern.length; y++) {
      for (let x = 0; x < pattern[y].length; x++) {
        const col = cmap[pattern[y][x]];
        if (col) px(ctx, 3 + x, 3 + y, col);
      }
    }
    // White star in flag
    px(ctx, 5, 5, "#fff");
    px(ctx, 6, 5, "#fff");

    ctx.restore();
  }

  fs.writeFileSync("src/assets/sprites/scenes/flag-red.png", c.toBuffer("image/png"));
  console.log("wrote flag-red.png", `${W * FRAMES}x${H}`, `${FRAMES} frames`);
}
