/** Avoid redundant MapLibre worker transfers without ever suppressing a
 *  different value. WeakMap is bound to the actual GeoJSONSource instance,
 *  so style replacement/new sources always receive their initial data.
 *
 *  Large datasets bypass the cache (not the update): important events must
 *  never disappear due to a lossy hash or truncated comparison.
 */
type WritableGeoSource = { setData: (data: {type:'FeatureCollection';features: unknown[]}) => unknown };
export const MAX_CACHED_SOURCE_BYTES = 256 * 1024;
export function createMapSourceWriteGuard(maxBytes = MAX_CACHED_SOURCE_BYTES) {
  const previous = new WeakMap<object, string>();
  return (source: WritableGeoSource, features: unknown[]): boolean => {
    const data = { type: 'FeatureCollection' as const, features };
    // A byte cap checked only *after* JSON.stringify would impose a second
    // costly traversal of every large flight/atlas feed. Abort serialization
    // early for heavy arrays/nested geometry; always forward the raw data.
    const tooLarge = Symbol('map-data-too-large');
    let observedChars = 0;
    let visitedNodes = 0;
    let serialized: string | null = null;
    try {
      serialized = JSON.stringify(data, (_key, value: unknown) => {
        observedChars += typeof value === 'string' ? value.length : 8;
        if (++visitedNodes > 2400 || observedChars > maxBytes ||
          (Array.isArray(value) && value.length > 350)) throw tooLarge;
        return value;
      });
    } catch (error) {
      if (error !== tooLarge) throw error;
    }
    if (serialized !== null && serialized.length <= maxBytes
      && previous.get(source) === serialized) return false;
    source.setData(data);
    if (serialized !== null && serialized.length <= maxBytes) previous.set(source, serialized);
    else previous.delete(source);
    return true;
  };
}
