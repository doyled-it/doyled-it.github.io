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

// --- Player sprite (16w x 20h, facing right) ---
// Glove hand = BACK (sprite LEFT), Throwing hand = FRONT (sprite RIGHT)
// Frames: 0=ready, 1=prep, 2=wind-up-low, 3=wind-up-high, 4=release, 5=follow-through,
//         6=reach-forward, 7=catch-high
const CAP_TRIM = "#ffffff";
const SKIN_SHADE = "#d9a26b";
const SHIRT_TRIM = "#c41e3a";
const GLOVE_D = "#5a2d0a";
const SHOE = "#1a1a1a";

function drawBody(ctx, ox, oy, legFrame = 0) {
  // Cap dome
  rect(ctx, ox + 5, oy + 0, 5, 1, CAP);
  rect(ctx, ox + 4, oy + 1, 6, 1, CAP);
  px(ctx, ox + 6, oy + 1, CAP_TRIM);
  px(ctx, ox + 8, oy + 1, CAP_TRIM);
  // Cap bill (protruding to the right = facing right)
  rect(ctx, ox + 10, oy + 2, 2, 1, CAP);
  px(ctx, ox + 12, oy + 2, "#8a0e25");

  // Face / head
  rect(ctx, ox + 5, oy + 2, 5, 1, SKIN);
  rect(ctx, ox + 4, oy + 3, 6, 3, SKIN);
  // Ear
  px(ctx, ox + 4, oy + 3, SKIN_SHADE);
  px(ctx, ox + 4, oy + 4, SKIN_SHADE);
  // Eye
  px(ctx, ox + 8, oy + 4, BLACK);
  // Nose / cheek
  px(ctx, ox + 9, oy + 5, SKIN_SHADE);
  // Chin shadow
  rect(ctx, ox + 5, oy + 6, 4, 1, SKIN_SHADE);

  // Neck
  rect(ctx, ox + 6, oy + 7, 3, 1, SKIN_SHADE);

  // Torso / jersey
  rect(ctx, ox + 4, oy + 8, 6, 5, SHIRT);
  // Pinstripe on front (facing right = right side is front)
  px(ctx, ox + 7, oy + 9, SHIRT_TRIM);
  px(ctx, ox + 7, oy + 10, SHIRT_TRIM);
  px(ctx, ox + 7, oy + 11, SHIRT_TRIM);
  // Jersey number
  px(ctx, ox + 8, oy + 10, SHIRT_TRIM);
  // Shoulder shading
  rect(ctx, ox + 4, oy + 8, 1, 5, SHIRT_D);
  px(ctx, ox + 9, oy + 8, SHIRT_TRIM);

  // Belt
  rect(ctx, ox + 4, oy + 13, 6, 1, BLACK);
  px(ctx, ox + 6, oy + 13, "#c0c0c0"); // belt buckle

  // Hips / upper pants
  rect(ctx, ox + 4, oy + 14, 6, 1, PANTS);

  // Legs (with motion)
  if (legFrame === 0) {
    // Standing
    rect(ctx, ox + 4, oy + 15, 2, 3, PANTS);
    rect(ctx, ox + 8, oy + 15, 2, 3, PANTS);
    rect(ctx, ox + 4, oy + 18, 3, 1, SHOE);
    rect(ctx, ox + 8, oy + 18, 3, 1, SHOE);
    px(ctx, ox + 5, oy + 19, SHOE);
    px(ctx, ox + 9, oy + 19, SHOE);
  } else if (legFrame === 1) {
    // Front leg stepping forward
    rect(ctx, ox + 4, oy + 15, 2, 3, PANTS);
    rect(ctx, ox + 4, oy + 18, 3, 1, SHOE);
    rect(ctx, ox + 9, oy + 15, 2, 2, PANTS);
    rect(ctx, ox + 10, oy + 17, 2, 1, PANTS);
    rect(ctx, ox + 10, oy + 18, 3, 1, SHOE);
    px(ctx, ox + 12, oy + 19, SHOE);
  } else if (legFrame === 2) {
    // Back leg planted, front leg follow-through
    rect(ctx, ox + 3, oy + 15, 2, 3, PANTS);
    rect(ctx, ox + 3, oy + 18, 3, 1, SHOE);
    rect(ctx, ox + 9, oy + 15, 2, 3, PANTS);
    rect(ctx, ox + 9, oy + 18, 3, 1, SHOE);
  }
}

function drawPlayer(ctx, ox, oy, frame = 0) {
  // Pick leg pose based on frame
  let legFrame = 0;
  if (frame === 2 || frame === 3) legFrame = 1; // wind-up, step into throw
  if (frame === 4 || frame === 5) legFrame = 2; // release / follow-through
  if (frame === 6 || frame === 7) legFrame = 1; // stepping forward for catch

  drawBody(ctx, ox, oy, legFrame);

  // Arm/glove positions per frame
  if (frame === 0) {
    // READY: both arms at sides, glove at left hip, bare hand at right hip
    rect(ctx, ox + 3, oy + 9, 1, 4, SHIRT);          // glove shoulder
    rect(ctx, ox + 2, oy + 12, 2, 2, GLOVE);         // glove at hip
    px(ctx, ox + 2, oy + 13, GLOVE_D);
    rect(ctx, ox + 10, oy + 9, 1, 4, SHIRT);         // throwing shoulder
    rect(ctx, ox + 10, oy + 13, 1, 1, SKIN);         // bare hand

  } else if (frame === 1) {
    // PREP: arms moving — glove coming forward, throwing arm bending back
    rect(ctx, ox + 3, oy + 9, 1, 2, SHIRT);
    rect(ctx, ox + 3, oy + 11, 2, 2, SHIRT);         // glove arm angled forward
    rect(ctx, ox + 5, oy + 11, 2, 2, GLOVE);
    px(ctx, ox + 5, oy + 12, GLOVE_D);
    rect(ctx, ox + 10, oy + 9, 1, 2, SHIRT);
    rect(ctx, ox + 11, oy + 11, 1, 2, SHIRT);        // throwing arm pulling back
    px(ctx, ox + 12, oy + 12, SKIN);

  } else if (frame === 2) {
    // WIND-UP LOW: glove arm up-forward, throwing arm down and back
    rect(ctx, ox + 3, oy + 8, 1, 2, SHIRT);
    rect(ctx, ox + 2, oy + 10, 2, 2, SHIRT);         // glove arm forward
    rect(ctx, ox + 0, oy + 8, 2, 3, GLOVE);          // glove far forward
    px(ctx, ox + 0, oy + 9, GLOVE_D);
    rect(ctx, ox + 10, oy + 9, 1, 3, SHIRT);
    rect(ctx, ox + 11, oy + 11, 2, 2, SHIRT);        // throwing arm behind
    rect(ctx, ox + 13, oy + 12, 1, 2, SKIN);

  } else if (frame === 3) {
    // WIND-UP HIGH: glove forward high, throwing arm high behind head
    rect(ctx, ox + 3, oy + 8, 1, 2, SHIRT);
    rect(ctx, ox + 1, oy + 8, 3, 2, SHIRT);          // glove arm forward
    rect(ctx, ox + 0, oy + 6, 2, 3, GLOVE);          // glove up forward
    px(ctx, ox + 0, oy + 7, GLOVE_D);
    rect(ctx, ox + 10, oy + 7, 1, 3, SHIRT);         // throwing shoulder up
    rect(ctx, ox + 11, oy + 5, 2, 3, SHIRT);         // arm up high
    rect(ctx, ox + 12, oy + 3, 2, 2, SKIN);          // hand back behind head

  } else if (frame === 4) {
    // RELEASE: throwing arm extending forward, glove arm pulling down
    rect(ctx, ox + 3, oy + 10, 1, 2, SHIRT);
    rect(ctx, ox + 2, oy + 11, 2, 2, SHIRT);
    rect(ctx, ox + 1, oy + 12, 2, 2, GLOVE);         // glove low
    px(ctx, ox + 1, oy + 13, GLOVE_D);
    rect(ctx, ox + 10, oy + 8, 2, 1, SHIRT);         // shoulder extended
    rect(ctx, ox + 11, oy + 8, 3, 2, SHIRT);         // upper arm forward
    rect(ctx, ox + 14, oy + 8, 1, 3, SKIN);          // hand reaching forward

  } else if (frame === 5) {
    // FOLLOW-THROUGH: throwing arm down across body, glove tucked in
    rect(ctx, ox + 4, oy + 11, 2, 2, SHIRT);
    rect(ctx, ox + 3, oy + 13, 2, 1, GLOVE);
    rect(ctx, ox + 10, oy + 9, 1, 2, SHIRT);
    rect(ctx, ox + 9, oy + 11, 2, 3, SHIRT);         // arm across body
    rect(ctx, ox + 8, oy + 13, 1, 1, SKIN);

  } else if (frame === 6) {
    // REACH FORWARD: glove extended forward to receive ball
    rect(ctx, ox + 3, oy + 9, 1, 2, SHIRT);
    rect(ctx, ox + 1, oy + 8, 3, 2, SHIRT);          // glove arm forward
    rect(ctx, ox + 0, oy + 7, 1, 3, SHIRT);
    rect(ctx, ox + 0, oy + 5, 2, 3, GLOVE);          // glove up high forward
    px(ctx, ox + 0, oy + 6, GLOVE_D);
    px(ctx, ox + 1, oy + 7, GLOVE_D);
    rect(ctx, ox + 10, oy + 9, 1, 4, SHIRT);         // throwing arm at side
    rect(ctx, ox + 10, oy + 13, 1, 1, SKIN);

  } else if (frame === 7) {
    // CATCH HIGH: glove raised up high, ball just caught
    rect(ctx, ox + 3, oy + 8, 1, 3, SHIRT);
    rect(ctx, ox + 1, oy + 5, 2, 4, SHIRT);          // arm raised up
    rect(ctx, ox + 0, oy + 2, 3, 4, GLOVE);          // glove way up
    px(ctx, ox + 1, oy + 3, GLOVE_D);
    px(ctx, ox + 2, oy + 4, GLOVE_D);
    rect(ctx, ox + 10, oy + 9, 1, 4, SHIRT);
    rect(ctx, ox + 10, oy + 13, 1, 1, SKIN);
  }
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

// Player sprite: 8 frames — ready, prep, wind-up-low, wind-up-high,
//                            release, follow-through, reach, catch
// Single sprite used for both players; right player is flipped via CSS
function writePlayerSprite(filename) {
  const FRAMES = 8;
  const W = 16, H = 20;
  const c = createCanvas(W * FRAMES, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * W, 0);
    drawPlayer(ctx, 0, 0, f);
    ctx.restore();
  }
  fs.mkdirSync("src/assets/sprites/scenes", { recursive: true });
  fs.writeFileSync(`src/assets/sprites/scenes/${filename}`, c.toBuffer("image/png"));
  console.log(`wrote ${filename}`, `${W * FRAMES}x${H}`, `${FRAMES} frames`);
}

writePlayerSprite("player-left.png");
writePlayerSprite("player-right.png");

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
// Foul pole — tall yellow pole with mesh screen panel near top.
// Static sprite (pole doesn't move), but screen has subtle shimmer frames.
// 10w x 40h canvas, 2 frames
// ===========================================================================
{
  const FRAMES = 2;
  const W = 10, H = 40;
  const c = createCanvas(W * FRAMES, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const POLE = "#ffe14d";
  const POLE_D = "#c8a62a";
  const POLE_L = "#fff5a0";
  const MESH = "#e8c820";
  const MESH_L = "#ffec6b";
  const BLACK = "#1a1a1a";

  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * W, 0);

    // === Foul pole — tall thin vertical yellow column ===
    // Dark outlines both sides, full height
    rect(ctx, 3, 0, 1, 40, BLACK);
    rect(ctx, 6, 0, 1, 40, BLACK);
    // Pole body
    rect(ctx, 4, 0, 2, 40, POLE);
    // Highlight on left
    rect(ctx, 4, 0, 1, 40, POLE_L);
    // Shadow on right (subtle)
    px(ctx, 5, 5, POLE_D);
    px(ctx, 5, 15, POLE_D);
    px(ctx, 5, 25, POLE_D);
    px(ctx, 5, 35, POLE_D);

    // === Mesh/screen panel near top (where the pole meets fair territory) ===
    // Sits to the RIGHT of the pole (inside the playing field)
    // Outline box
    rect(ctx, 6, 6, 1, 12, BLACK);    // left edge (adjacent to pole)
    rect(ctx, 9, 6, 1, 12, BLACK);    // right edge
    rect(ctx, 7, 5, 2, 1, BLACK);     // top
    rect(ctx, 7, 18, 2, 1, BLACK);    // bottom
    // Mesh fill
    rect(ctx, 7, 6, 2, 12, MESH);
    // Highlight column
    rect(ctx, 7, 6, 1, 12, MESH_L);
    // Crosshatch grid pattern — slight shift between frames
    const offset = f === 0 ? 0 : 1;
    for (let y = 6 + offset; y < 18; y += 3) {
      px(ctx, 7, y, POLE_D);
      px(ctx, 8, y, POLE_D);
    }
    for (let y = 7; y < 18; y += 3) {
      px(ctx, 7 + ((y + f) % 2), y, BLACK);
    }

    // === Tiny cap on top of pole ===
    rect(ctx, 2, 0, 1, 1, BLACK);
    rect(ctx, 7, 0, 1, 1, BLACK);
    px(ctx, 3, 0, POLE_L);
    px(ctx, 6, 0, POLE_D);

    ctx.restore();
  }

  fs.writeFileSync("src/assets/sprites/scenes/foul-pole.png", c.toBuffer("image/png"));
  console.log("wrote foul-pole.png", `${W * FRAMES}x${H}`, `${FRAMES} frames`);
}
