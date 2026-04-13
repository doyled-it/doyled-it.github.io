const COURSE_MAP = {
  "25.8/76": "The Loma Club",
  "30.5/96": "Balboa Park GC (9H)",
  "71.5/126": "Balboa Park GC",
  "68.3/119": "Sea 'N Air GC",
  "75/139": "Torrey Pines (South)",
  "71.5/125": "Torrey Pines (North)",
  "70.8/126": "Noosa Springs CC",
  "68.9/131": "Mt. Woodson GC",
  "66.5/125": "Mt. Woodson GC",
  "68.4/120": "Redmond Ridge GC",
  "69.2/120": "Balboa Park GC",
  "70.1/123": "Balboa Park GC",
  "53.4/73": "Mission Bay GC",
  "70/126": "Sierra Sage GC",
};

export function enrichScores(scores) {
  return scores.map((s) => ({
    ...s,
    course_name: s.course_name || COURSE_MAP[`${s.course_rating}/${s.slope_rating}`] || `${s.course_rating}/${s.slope_rating}`,
  }));
}
