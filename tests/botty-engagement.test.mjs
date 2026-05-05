import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngagement } from "../lib/botty-engagement.mjs";

const CFG = {
  triggerTimeMs: 4000,
  triggerMousePx: 250,
  burstEndAfterMs: 120000,
};

test("does not fire before either threshold", () => {
  const e = createEngagement(CFG, { now: 0 });
  e.tick(3000);
  assert.equal(e.shouldFire(), false);
});

test("fires after time threshold", () => {
  const e = createEngagement(CFG, { now: 0 });
  e.tick(4500);
  assert.equal(e.shouldFire(), true);
});

test("fires after mouse threshold even before time threshold", () => {
  const e = createEngagement(CFG, { now: 0 });
  e.recordMouseMovement(300);
  e.tick(1000);
  assert.equal(e.shouldFire(), true);
});

test("does not re-fire while in same burst", () => {
  const e = createEngagement(CFG, { now: 0 });
  e.tick(5000);
  assert.equal(e.shouldFire(), true);
  e.markFired(5000);
  e.tick(10000);
  e.recordActivity(10000);
  assert.equal(e.shouldFire(), false);
});

test("re-fires after burst ends and new activity arrives", () => {
  const e = createEngagement(CFG, { now: 0 });
  e.tick(5000);
  e.markFired(5000);

  e.tick(135000);
  assert.equal(e.shouldFire(), false);

  e.recordActivity(135000);
  e.tick(140000);
  assert.equal(e.shouldFire(), true);
});

test("qrBypass fires immediately on first tick", () => {
  const e = createEngagement({ ...CFG, qrBypass: true }, { now: 0 });
  e.tick(100);
  assert.equal(e.shouldFire(), true);
});

test("recordMouseMovement accumulates", () => {
  const e = createEngagement(CFG, { now: 0 });
  e.recordMouseMovement(100);
  e.recordMouseMovement(100);
  e.tick(500);
  assert.equal(e.shouldFire(), false);
  e.recordMouseMovement(100);
  assert.equal(e.shouldFire(), true);
});
