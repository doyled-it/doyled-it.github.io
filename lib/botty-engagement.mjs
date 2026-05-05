export function createEngagement(cfg, init = {}) {
  let mouseDistance = 0;
  let lastActivityAt = init.now ?? 0;
  let lastFiredAt = -Infinity;
  let nowMs = init.now ?? 0;

  function inActiveBurst() {
    return lastFiredAt > -Infinity
      && (nowMs - lastFiredAt < cfg.burstEndAfterMs)
      && (nowMs - lastActivityAt < cfg.burstEndAfterMs);
  }

  return {
    tick(t) {
      nowMs = t;
    },
    recordMouseMovement(px) {
      mouseDistance += px;
      lastActivityAt = nowMs;
    },
    recordActivity(t) {
      lastActivityAt = t;
      nowMs = t;
    },
    markFired(t) {
      lastFiredAt = t;
      mouseDistance = 0;
    },
    shouldFire() {
      if (cfg.qrBypass) return lastFiredAt === -Infinity;
      if (inActiveBurst()) return false;
      if (lastFiredAt > -Infinity && lastActivityAt <= lastFiredAt) return false;
      return nowMs >= cfg.triggerTimeMs || mouseDistance >= cfg.triggerMousePx;
    },
  };
}
