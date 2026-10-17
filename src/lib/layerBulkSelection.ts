type LayerChoice = { key: string; parent?: string };

/** Bulk data actions preserve presentation, child preferences and unrelated state. */
export function selectDataLayers<T extends Record<string, unknown>>(
  previous: T,
  layers: readonly LayerChoice[],
  enabled: boolean,
  presentationKeys: readonly string[],
  canSelect: (key: string) => boolean,
): T {
  const presentation = new Set(presentationKeys);
  const next = { ...previous };
  for (const layer of layers) {
    if (!layer.parent && !presentation.has(layer.key) && canSelect(layer.key)) {
      (next as Record<string, unknown>)[layer.key] = enabled;
    }
  }
  return next;
}
