export function chooseDirection(fromX, fromY, toX, toY, idleThreshold = 8) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.hypot(dx, dy) < idleThreshold) return "idle";
  const angle = Math.atan2(dy, dx);
  const deg = (angle * 180) / Math.PI;
  if (deg >= -22.5 && deg < 22.5) return "E";
  if (deg >= 22.5 && deg < 67.5) return "SE";
  if (deg >= 67.5 && deg < 112.5) return "S";
  if (deg >= 112.5 && deg < 157.5) return "SW";
  if (deg >= 157.5 || deg < -157.5) return "W";
  if (deg >= -157.5 && deg < -112.5) return "NW";
  if (deg >= -112.5 && deg < -67.5) return "N";
  return "NE";
}

export function stepToward(from, to, speed) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= speed) return { x: to.x, y: to.y };
  return {
    x: from.x + (dx / dist) * speed,
    y: from.y + (dy / dist) * speed,
  };
}

export function pickRandom(list, rng = Math.random) {
  const idx = Math.min(Math.floor(rng() * list.length), list.length - 1);
  return list[idx];
}
