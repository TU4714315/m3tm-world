import type { SatelliteVisualPreset } from './satellite-visual-preset';

export const WORLD_WORKSPACE_STORAGE_KEY = 'm3tm:world:workspace:v1';

export type WorldWorkspaceSnapshot = {
  version: 1;
  savedAt: string;
  activeLayers: Record<string, boolean>;
  projection: 'globe' | 'mercator';
  mapStyle: 'dark' | 'satellite';
  theme: 'core' | 'ghost';
  satelliteVisual: SatelliteVisualPreset;
  view: { lat: number; lng: number; zoom: number };
};

const finiteIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function parseWorldWorkspaceSnapshot(raw: string | null): WorldWorkspaceSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WorldWorkspaceSnapshot>;
    if (value.version !== 1 || typeof value.savedAt !== 'string') return null;
    if (!value.activeLayers || typeof value.activeLayers !== 'object' || Array.isArray(value.activeLayers)) return null;
    if (value.projection !== 'globe' && value.projection !== 'mercator') return null;
    if (value.mapStyle !== 'dark' && value.mapStyle !== 'satellite') return null;
    if (value.theme !== 'core' && value.theme !== 'ghost') return null;
    if (!['original', 'clarity', 'bright'].includes(String(value.satelliteVisual))) return null;
    const view = value.view;
    if (!view || !finiteIn(view.lat, -90, 90) || !finiteIn(view.lng, -180, 180) || !finiteIn(view.zoom, 0, 24)) return null;

    const activeLayers = Object.fromEntries(
      Object.entries(value.activeLayers).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    );
    return {
      version: 1,
      savedAt: value.savedAt,
      activeLayers,
      projection: value.projection,
      mapStyle: value.mapStyle,
      theme: value.theme,
      satelliteVisual: value.satelliteVisual as SatelliteVisualPreset,
      view,
    };
  } catch {
    return null;
  }
}

export function loadWorldWorkspaceSnapshot(): WorldWorkspaceSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseWorldWorkspaceSnapshot(window.localStorage.getItem(WORLD_WORKSPACE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveWorldWorkspaceSnapshot(snapshot: Omit<WorldWorkspaceSnapshot, 'version' | 'savedAt'>): string | null {
  if (typeof window === 'undefined') return null;
  const savedAt = new Date().toISOString();
  try {
    window.localStorage.setItem(WORLD_WORKSPACE_STORAGE_KEY, JSON.stringify({ version: 1, savedAt, ...snapshot }));
    return savedAt;
  } catch {
    return null;
  }
}
