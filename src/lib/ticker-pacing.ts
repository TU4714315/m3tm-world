/** Time to show one headline in the moving lane; the duplicate lane is seamless. */
export const HEADLINE_SCROLL_SECONDS = 4.5;

export function tickerLoopSeconds(itemCount: number): number {
  // One item would disappear immediately at 4.5s; give it a full second pass.
  return Math.max(9, Math.min(54, Math.max(0, itemCount) * HEADLINE_SCROLL_SECONDS));
}
