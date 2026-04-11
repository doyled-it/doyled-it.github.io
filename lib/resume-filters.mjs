const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatYM(s) {
  if (!s) return "";
  const [y, m] = String(s).split("-");
  if (!m) return y;
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11 || Number.isNaN(idx)) return y;
  return `${MONTHS[idx]} ${y}`;
}

export function dateRange(start, end) {
  const startStr = formatYM(start);
  const endStr = end ? formatYM(end) : "present";
  if (!startStr && !end) return "";
  if (!startStr) return `— ${endStr}`;
  return `${startStr} — ${endStr}`;
}

export function yearOf(s) {
  if (!s) return "";
  return String(s).split("-")[0];
}
