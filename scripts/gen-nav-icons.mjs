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

// Render a pixel art bitmap from a string array
function renderBitmap(ctx, ox, oy, lines, colorMap) {
  for (let y = 0; y < lines.length; y++) {
    for (let x = 0; x < lines[y].length; x++) {
      const c = colorMap[lines[y][x]];
      if (c) px(ctx, ox + x, oy + y, c);
    }
  }
}

const K = "#1a1a1a";  // outline / black
const W = "#ffffff";  // white

// --- HOME: clear pitched roof house ---
writeIcon("home", (ctx) => {
  const map = {
    ".": null,
    K: K,
    R: "#c41e3a",   // roof
    r: "#8a0e25",   // roof shadow
    Y: "#e8c48f",   // wall
    y: "#c8a570",   // wall shadow
    B: "#8B4513",   // door
    b: "#5a2d0a",   // door shadow
    G: "#ffe14d",   // doorknob
    L: "#87ceeb",   // window glass
    l: "#5a9cc8",   // window shadow
  };
  const art = [
    "................",
    "........K.......",
    ".......KRK......",
    "......KRRRK.....",
    ".....KRRRRRK....",
    "....KRRRRRRRK...",
    "...KRRRRRRRRRK..",
    "..KRrrrrrrrrrK..",
    ".KKKKKKKKKKKKK..",
    ".KYLLYYYLLYBBK..",
    ".KYLLYYYLLYBBK..",
    ".KYYYYYYYYYBGK..",
    ".KYYYYYYYYYBBK..",
    ".KYYYYYYYYYBBK..",
    ".KKKKKKKKKKKKK..",
    "................",
  ];
  renderBitmap(ctx, 0, 0, art, map);
});

// --- RESUME: clean document with header line and text rows ---
writeIcon("resume", (ctx) => {
  const map = {
    ".": null,
    K: K,
    W: W,
    g: "#ddd",
    H: "#c41e3a",   // header bar
    T: "#666",      // text line
  };
  const art = [
    "................",
    "..KKKKKKKKKKK...",
    "..KWWWWWWWgKK...",
    "..KWHHHHHWggK...",
    "..KWHHHHHWgWK...",
    "..KWWWWWWWWWK...",
    "..KWTTTTTTWWK...",
    "..KWWWWWWWWWK...",
    "..KWTTTTTTWWK...",
    "..KWTTTTWWWWK...",
    "..KWWWWWWWWWK...",
    "..KWTTTTTTTWK...",
    "..KWTTTWWWWWK...",
    "..KWWWWWWWWWK...",
    "..KKKKKKKKKKK...",
    "................",
  ];
  renderBitmap(ctx, 0, 0, art, map);
});

// --- PROJECTS: hammer and wrench side by side ---
writeIcon("projects", (ctx) => {
  const map = {
    ".": null,
    K: K,
    H: "#999",      // hammer/wrench head (steel)
    h: "#666",      // steel shadow
    L: "#ccc",      // steel highlight
    B: "#8B4513",   // wood handle
    b: "#5a2d0a",   // wood shadow
  };
  // Left: hammer (head at top, vertical handle below)
  // Right: wrench (open jaw at top, vertical handle below)
  // Centered in the 16x16 frame
  const art = [
    "................",
    "..KKKKK..KKKK...",
    ".KLHHHK.KLHKHK..",
    ".KHHHHK.KHKKHK..",
    ".KHHHHK.KHKKHK..",
    ".KKHHKK.KHHHHK..",
    "..KBBK...KHHK...",
    "..KBBK...KHHK...",
    "..KBBK...KHHK...",
    "..KBBK...KHHK...",
    "..KBbK...KHHK...",
    "..KBbK...KHHK...",
    "..KBbK...KHHK...",
    "..KBbK...KHHK...",
    "..KKKK...KKKK...",
    "................",
  ];
  renderBitmap(ctx, 0, 0, art, map);
});

// --- WORDS: open book ---
writeIcon("words", (ctx) => {
  const map = {
    ".": null,
    K: K,
    W: W,
    g: "#ddd",
    T: "#888",   // text lines
    B: "#8B4513",// book cover
    b: "#5a2d0a",// cover shadow
  };
  const art = [
    "................",
    "..BBKKK.KKKBB...",
    ".BBWWWBKBWWWBB..",
    ".BWTTTWBWTTTWB..",
    ".BWWWWWBWWWWWB..",
    ".BWTTTBWBWTTTB..",
    ".BWWWWWBWWWWWB..",
    ".BWTTWWBWWTTWB..",
    ".BWWWWWBWWWWWB..",
    ".BWTTTBWBWTTTB..",
    ".BWWWWWBWWWWWB..",
    ".BWTTWWBWWTTWB..",
    ".BWWWWWBWWWWWB..",
    ".BBWWWBBWWWWBB..",
    "..BBKKKBKKKBB...",
    "...bbbbbbbbb....",
  ];
  renderBitmap(ctx, 0, 0, art, map);
});

// --- MUSIC: cassette tape with clear reels ---
writeIcon("music", (ctx) => {
  const map = {
    ".": null,
    K: K,
    B: "#222",      // body
    L: "#fffbe6",   // label
    Y: "#e8c820",   // reel
    y: "#c8a62a",   // reel inner
    T: "#666",      // text on label
  };
  const art = [
    "................",
    "................",
    "................",
    "KKKKKKKKKKKKKKKK",
    "KBBBBBBBBBBBBBBK",
    "KBLLLLLLLLLLLLBK",
    "KBLTTTTTTTTTTLBK",
    "KBLLLLLLLLLLLLBK",
    "KBKYYKBBBBKYYKBK",
    "KBKYKYKKKKYKYKBK",
    "KBKYYKBBBBKYYKBK",
    "KBKKKBBBBBBKKKBK",
    "KBBBBBBBBBBBBBBK",
    "KKKKKKKKKKKKKKKK",
    "................",
    "................",
  ];
  renderBitmap(ctx, 0, 0, art, map);
});

// --- BASEBALL: bracket-shaped laces matching real ball stitching ---
writeIcon("baseball", (ctx) => {
  const map = {
    ".": null,
    K: K,
    W: W,
    R: "#c41e3a",   // stitch
  };
  // Two thick vertical laces with stair-step flares at top and bottom.
  // Mimics the baseball stitch pattern from the reference.
  const art = [
    "................",
    "....KKKKKKKK....",
    "...KWWWWWWWWK...",
    "..KWRRWWWWRRWK..",
    ".KWRRWWWWWWRRWK.",
    ".KWWRRWWWWRRWWK.",
    "KWWWRRWWWWRRWWWK",
    "KWWWRRWWWWRRWWWK",
    "KWWWRRWWWWRRWWWK",
    "KWWWRRWWWWRRWWWK",
    ".KWWRRWWWWRRWWK.",
    ".KWRRWWWWWWRRWK.",
    "..KWRRWWWWRRWK..",
    "...KWWWWWWWWK...",
    "....KKKKKKKK....",
    "................",
  ];
  renderBitmap(ctx, 0, 0, art, map);
});

// --- GOLF: small green mound with hole and flagstick ---
writeIcon("golf", (ctx) => {
  const map = {
    ".": null,
    K: K,
    P: "#c0c0c0",  // pin/pole
    p: "#888",     // pin shadow
    R: "#c41e3a",  // flag
    r: "#8a0e25",  // flag shadow
    G: "#4caf50",  // green
    g: "#2d7a32",  // green shadow
    L: "#7ed981",  // green light
    H: K,          // hole (black)
  };
  const art = [
    "................",
    "........K.......",
    ".......KKK......",
    "......KPRRK.....",
    "......KPRRrK....",
    "......KPRRrK....",
    "......KPRRK.....",
    "......KP........",
    "......KP........",
    "......KP........",
    "......KP........",
    "...KKKHHHKKK....",
    "..KGGLLLLLGGgK..",
    ".KGGLLGGGGLGggK.",
    "KGGGGGGGGGGGggK.",
    ".KGGGggggggggK..",
  ];
  renderBitmap(ctx, 0, 0, art, map);
});

// --- CONTACT: clean square envelope with V flap ---
writeIcon("contact", (ctx) => {
  const map = {
    ".": null,
    K: K,
    W: W,
    g: "#e0e0e0",
  };
  const art = [
    "................",
    "................",
    ".KKKKKKKKKKKKKK.",
    ".KWWWWWWWWWWWWK.",
    ".KKWWWWWWWWWWKK.",
    ".KgKWWWWWWWWKgK.",
    ".KggKWWWWWWKggK.",
    ".KgggKWWWWKgggK.",
    ".KggggKWWKggggK.",
    ".KgggggKKgggggK.",
    ".KggggggggggggK.",
    ".KggggggggggggK.",
    ".KggggggggggggK.",
    ".KKKKKKKKKKKKKK.",
    "................",
    "................",
  ];
  renderBitmap(ctx, 0, 0, art, map);
});
