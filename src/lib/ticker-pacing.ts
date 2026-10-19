/** Time to show one headline in the moving lane; the duplicate lane is seamless. */
export const HEADLINE_SCROLL_SECONDS = 7.5;

export function tickerLoopSeconds(itemCount: number): number {
  // Give sparse feeds enough time for a readable first pass.
  return Math.max(12, Math.min(90, Math.max(0, itemCount) * HEADLINE_SCROLL_SECONDS));
}
