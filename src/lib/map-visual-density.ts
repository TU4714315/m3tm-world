/** Visual clustering, not filtering: all original observations remain queryable.
 * Count bubbles represent camera/report records, never confirmed attacks.
 */
const CLUSTERS = {
  'gdelt-events': { cluster:true,clusterRadius:54,clusterMaxZoom:7 },
  'civil-unrest': { cluster:true,clusterRadius:54,clusterMaxZoom:7 },
  'cctv': { cluster:true,clusterRadius:44,clusterMaxZoom:8 },
  'app-news': { cluster:true,clusterRadius:48,clusterMaxZoom:8 },
} as const;
export function publicClusterOptions(source: string) {
  return CLUSTERS[source as keyof typeof CLUSTERS] || {};
}
