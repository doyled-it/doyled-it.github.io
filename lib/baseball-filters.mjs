export const colorThresholds = {
  avg: { great: 0.400, good: 0.300, poor: 0.200 },
  obp: { great: 0.450, good: 0.350, poor: 0.300 },
  slg: { great: 0.550, good: 0.450, poor: 0.350 },
  ops: { great: 1.000, good: 0.800, poor: 0.700 },
  babip: { great: 0.350, good: 0.300, poor: 0.250 },
  iso: { great: 0.200, good: 0.140, poor: 0.100 },
  bb_pct: { great: 0.12, good: 0.08, poor: 0.05 },
  k_pct: { great: 0.15, good: 0.20, poor: 0.25, inverse: true },
  clutch_avg: { great: 0.350, good: 0.275, poor: 0.200 },
  contact_quality: { great: 0.40, good: 0.30, poor: 0.20 },
  pitches_per_pa: { great: 4.5, good: 4.0, poor: 3.5 },
  fielding_pct: { great: 0.950, good: 0.900, poor: 0.850 },
  range_factor: { great: 3.0, good: 2.0, poor: 1.5 },
  era: { great: 3.00, good: 4.50, poor: 6.00, inverse: true },
  whip: { great: 1.20, good: 1.50, poor: 1.80, inverse: true },
  k_bb: { great: 2.5, good: 2.0, poor: 1.0 },
  k9: { great: 8.0, good: 6.0, poor: 4.0 },
};

export function statColor(value, metric) {
  const t = colorThresholds[metric];
  if (!t || value == null || !Number.isFinite(Number(value))) return "";
  const v = Number(value);
  const inv = !!t.inverse;
  const hit = (cut) => (inv ? v <= cut : v >= cut);
  if (hit(t.great)) return "stat-great";
  if (hit(t.good)) return "stat-good";
  if (hit(t.poor)) return "stat-average";
  return "stat-poor";
}

export function computeCalculated(stats) {
  const h = stats.hitting || {};
  const f = stats.fielding || {};
  const p = stats.pitching || {};
  const g = stats.games || {};

  const obpDen = (h.AB || 0) + (h.BB || 0) + (h.HBP || 0) + (h.SF || 0);
  const singles = Math.max(0, (h.H || 0) - (h["2B"] || 0) - (h["3B"] || 0) - (h.HR || 0));
  const tb = singles + 2 * (h["2B"] || 0) + 3 * (h["3B"] || 0) + 4 * (h.HR || 0);

  const AVG = h.AB ? h.H / h.AB : 0;
  const OBP = obpDen ? ((h.H || 0) + (h.BB || 0) + (h.HBP || 0)) / obpDen : 0;
  const SLG = h.AB ? tb / h.AB : 0;
  const OPS = OBP + SLG;
  const ISO = SLG - AVG;
  const XBH = (h["2B"] || 0) + (h["3B"] || 0) + (h.HR || 0);

  const babipDen = (h.AB || 0) - (h.K || 0) - (h.HR || 0) + (h.SF || 0);
  const BABIP = babipDen > 0 ? ((h.H || 0) - (h.HR || 0)) / babipDen : 0;

  const TC = f.TC || 0;
  const fieldingPct = TC ? ((f.PO || 0) + (f.A || 0)) / TC : 0;
  const rangeFactor = g.played ? ((f.PO || 0) + (f.A || 0)) / g.played : 0;

  let ERA = 0, WHIP = 0, K_BB = 0, K9 = 0, BB9 = 0;
  if (p.IP > 0) {
    ERA = ((p.ER || 0) * 9) / p.IP;
    WHIP = ((p.BB_p || 0) + (p.H_p || 0)) / p.IP;
    K_BB = p.BB_p ? (p.K_p || 0) / p.BB_p : (p.K_p || 0);
    K9 = ((p.K_p || 0) * 9) / p.IP;
    BB9 = ((p.BB_p || 0) * 9) / p.IP;
  }

  return {
    AVG, OBP, singles, tb, SLG, OPS,
    BABIP, ISO,
    XBH,
    XBH_pct: h.H ? XBH / h.H : 0,
    BB_pct: obpDen ? (h.BB || 0) / obpDen : 0,
    K_pct: obpDen ? (h.K || 0) / obpDen : 0,
    clutch_avg: h.RISP ? (h.RISP_H || 0) / h.RISP : 0,
    contact_quality: h.AB ? (h.hard_contact || 0) / h.AB : 0,
    pitches_per_pa: obpDen ? (h.pitches_seen || 0) / obpDen : 0,
    fieldingPct,
    rangeFactor,
    ERA, WHIP, K_BB, K9, BB9,
  };
}
