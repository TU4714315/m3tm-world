/** A cosmetic APP iframe preference only; never an authorization signal. */
export function embeddedBasemapPreference(
  query: URLSearchParams,
  embedded: boolean,
  publicSurface: boolean,
): 'dark' | null {
  return embedded && !publicSurface && query.get('basemap') === 'dark' ? 'dark' : null;
}
