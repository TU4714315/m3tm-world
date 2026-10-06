/**
 * Presentation-only overview of coarse, anonymized public activity cells.
 * Never derive tracks, headings, flight identities, or precise positions.
 */
export type PublicMilitaryActivityOverview = {
  total: number;
  low: number;
  medium: number;
  high: number;
  compared: number;
  increased: number;
  decreased: number;
  unchanged: number;
  unknown: number;
  stale: boolean;
};

type CoarseCell = {
  level?: unknown;
  trend?: unknown;
  data_state?: unknown;
};

export function publicMilitaryActivityOverview(
  input: unknown,
  sourceStale = false,
): PublicMilitaryActivityOverview {
  const cells: CoarseCell[] = Array.isArray(input)
    ? input.filter((cell): cell is CoarseCell => cell !== null && typeof cell === 'object' && !Array.isArray(cell))
    : [];

  const result: PublicMilitaryActivityOverview = {
    total: 0, low: 0, medium: 0, high: 0,
    compared: 0, increased: 0, decreased: 0, unchanged: 0,
    unknown: 0, stale: sourceStale || cells.some(cell => cell.data_state === 'cached-stale'),
  };
  for (const cell of cells) {
    // Unknown/malformed cells are never promoted to "low" or "confirmed".
    const level = cell.level;
    if (level !== 1 && level !== 2 && level !== 3) {
      result.unknown++;
      continue;
    }
    result.total++;
    if (level === 1) result.low++;
    if (level === 2) result.medium++;
    if (level === 3) result.high++;

    // Stale or newly appearing cells cannot substantiate an increase.
    if (result.stale) continue;
    if (cell.trend === 'up') result.increased++;
    if (cell.trend === 'down') result.decreased++;
    if (cell.trend === 'steady') result.unchanged++;
    if (cell.trend === 'up' || cell.trend === 'down' || cell.trend === 'steady') result.compared++;
  }
  // A mixed stale/live response cannot support a live trend claim.
  if (result.stale) {
    result.compared = 0;
    result.increased = 0;
    result.decreased = 0;
    result.unchanged = 0;
  }
  return result;
}
