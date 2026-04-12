import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseDirection, pickRandom, stepToward } from "../src/assets/js/buddies-core.mjs";

test("chooseDirection returns 'idle' when close", () => {
  assert.equal(chooseDirection(0, 0, 2, 2, 8), "idle");
});

test("chooseDirection identifies cardinal directions", () => {
  assert.equal(chooseDirection(0, 0, 100, 0, 8), "E");
  assert.equal(chooseDirection(0, 0, -100, 0, 8), "W");
  assert.equal(chooseDirection(0, 0, 0, -100, 8), "N");
  assert.equal(chooseDirection(0, 0, 0, 100, 8), "S");
});

test("chooseDirection identifies diagonals", () => {
  assert.equal(chooseDirection(0, 0, 100, -100, 8), "NE");
  assert.equal(chooseDirection(0, 0, -100, -100, 8), "NW");
  assert.equal(chooseDirection(0, 0, 100, 100, 8), "SE");
  assert.equal(chooseDirection(0, 0, -100, 100, 8), "SW");
});

test("stepToward moves at most `speed` pixels per axis", () => {
  const p = stepToward({ x: 0, y: 0 }, { x: 100, y: 50 }, 10);
  assert.ok(p.x > 0 && p.x <= 10);
  assert.ok(p.y > 0 && p.y <= 10);
});

test("stepToward stops at target", () => {
  const p = stepToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 10);
  assert.deepEqual(p, { x: 3, y: 4 });
});

test("pickRandom picks from list deterministically given rng", () => {
  assert.equal(pickRandom(["a", "b", "c"], () => 0), "a");
  assert.equal(pickRandom(["a", "b", "c"], () => 0.5), "b");
  assert.equal(pickRandom(["a", "b", "c"], () => 0.99), "c");
});
