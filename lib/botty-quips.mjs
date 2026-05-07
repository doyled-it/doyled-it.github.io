const SUFFIX_OPS = {
  _gte: (sigVal, target) => Number(sigVal) >= Number(target),
  _gt:  (sigVal, target) => Number(sigVal) >  Number(target),
  _lte: (sigVal, target) => Number(sigVal) <= Number(target),
  _lt:  (sigVal, target) => Number(sigVal) <  Number(target),
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

export function pickQuip(bank, signals, rng = Math.random, seenTemplates = []) {
  const matches = bank.filter((q) => matchPredicate(q.trigger, signals));
  if (matches.length === 0) return null;
  const maxSpec = Math.max(...matches.map((m) => specificity(m.trigger)));
  const tier = matches.filter((m) => specificity(m.trigger) === maxSpec);
  // Try not to repeat ourselves: filter out templates already shown this
  // session. If that empties the tier, fall back to the full tier so we
  // still pick *something* (better a repeat than silence).
  const seen = new Set(seenTemplates);
  const fresh = tier.filter((q) => !seen.has(q.template));
  const best = fresh.length > 0 ? fresh : tier;
  // Weighted random within the chosen pool. Default weight is 1 when
  // omitted, so adding `weight: 5` to a quip makes it ~5× as likely as
  // the unweighted peers at the same specificity tier.
  const totalWeight = best.reduce((sum, q) => sum + (q.weight ?? 1), 0);
  let pick = rng() * totalWeight;
  let chosen = best[best.length - 1];
  for (const q of best) {
    pick -= q.weight ?? 1;
    if (pick <= 0) { chosen = q; break; }
  }
  return { ...chosen, text: fillSlots(chosen.template, signals) };
}
