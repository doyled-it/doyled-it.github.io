const SUFFIX_OPS = {
  _gte: (sigVal, target) => Number(sigVal) >= Number(target),
  _lt: (sigVal, target) => Number(sigVal) < Number(target),
  _starts: (sigVal, target) => typeof sigVal === "string" && sigVal.startsWith(target),
  _contains: (sigVal, target) => typeof sigVal === "string" && sigVal.includes(target),
  _not: (sigVal, target) => sigVal !== target,
  _len_gte: (sigVal, target) => Array.isArray(sigVal) && sigVal.length >= Number(target),
};

function resolveKey(predKey) {
  for (const suffix of Object.keys(SUFFIX_OPS).sort((a, b) => b.length - a.length)) {
    if (predKey.endsWith(suffix)) {
      return { signalKey: predKey.slice(0, -suffix.length), op: SUFFIX_OPS[suffix] };
    }
  }
  return { signalKey: predKey, op: (sigVal, target) => sigVal === target };
}

export function matchPredicate(predicate, signals) {
  if (predicate === "*") return true;
  if (typeof predicate !== "object" || predicate === null) return false;
  for (const [predKey, target] of Object.entries(predicate)) {
    const { signalKey, op } = resolveKey(predKey);
    if (!op(signals[signalKey], target)) return false;
  }
  return true;
}

export function fillSlots(template, signals) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = signals[key];
    return v === undefined || v === null || v === "" ? "there" : String(v);
  });
}

function specificity(trigger) {
  if (trigger === "*") return 0;
  if (typeof trigger !== "object" || trigger === null) return 0;
  return Object.keys(trigger).length;
}

export function pickQuip(bank, signals, rng = Math.random) {
  const matches = bank.filter((q) => matchPredicate(q.trigger, signals));
  if (matches.length === 0) return null;
  const maxSpec = Math.max(...matches.map((m) => specificity(m.trigger)));
  const best = matches.filter((m) => specificity(m.trigger) === maxSpec);
  const idx = Math.min(best.length - 1, Math.floor(rng() * best.length));
  const chosen = best[idx];
  return { ...chosen, text: fillSlots(chosen.template, signals) };
}
