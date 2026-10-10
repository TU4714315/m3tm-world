import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';
import { cachedSource } from '@/lib/sourceCache';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * OSIRIS — Oregon CCTV Cameras (ODOT TripCheck)
 * Source: https://www.tripcheck.com/Scripts/map/data/cctvinventory.js
 * ~1,100 cameras statewide — NO API KEY NEEDED.
 *
 * The inventory is an Esri-style feature dump; frames are served from
 * tripcheck.com/RoadCams/cams/<filename>.
 */

const INVENTORY = 'https://www.tripcheck.com/Scripts/map/data/cctvinventory.js';
const IMAGE_BASE = 'https://tripcheck.com/RoadCams/cams';

/** Oregon bounding box — drops any stray/placeholder coordinates. */
const OR_BOUNDS = { minLat: 41.9, maxLat: 46.3, minLng: -124.6, maxLng: -116.4 };

export interface TripCheckFeature {
  attributes?: {
    cameraId?: number;
    filename?: string | null;
    latitude?: number;
    longitude?: number;
    route?: string | null;
    title?: string | null;
  };
}

/** Map one TripCheck feature to a camera, or null if unusable. Exported for tests. */
export function mapFeature(feature: TripCheckFeature): CctvCamera | null {
  const a = feature?.attributes;
  if (!a || a.cameraId == null || !a.filename) return null;

  const lat = a.latitude;
  const lng = a.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat! < OR_BOUNDS.minLat || lat! > OR_BOUNDS.maxLat) return null;
  if (lng! < OR_BOUNDS.minLng || lng! > OR_BOUNDS.maxLng) return null;

  return {
    id: `odot-${a.cameraId}`,
    lat: lat!,
    lng: lng!,
    name: (a.title || a.route || `ODOT Camera ${a.cameraId}`).trim(),
    city: (a.route || 'Oregon').trim(),
    country: 'US',
    feed_url: `${IMAGE_BASE}/${a.filename}`,
    source: 'ODOT TripCheck',
  };
}

/**
 * Render Free has ephemeral local storage; this last-successful index survives
 * process restarts only while the container's filesystem survives. It is NOT
 * a cross-deployment durable archive. Never manufacture cameras when neither
 * TripCheck nor a validated last-good snapshot can supply them.
 */
const BACKUP_FILE = join(tmpdir(), 'm3tm-oregon-camera-index-v1.json');
const MAX_BACKUP_AGE_MS = 7 * 24 * 60 * 60_000;
const MAX_CAMERAS = 5000;
const FETCH_TIMEOUT_MS = 4500;
const RETRY_DELAY_MS = 250;

function transientUpstreamError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  const root = (error as Error & { cause?: unknown }).cause;
  const code = (root as { code?: unknown } | null)?.code;
  return ['EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(String(code));
}

function validBackupCamera(camera: unknown): camera is CctvCamera {
  if (!camera || typeof camera !== 'object') return false;
  const c = camera as Record<string, unknown>;
  return typeof c.id === 'string' && /^odot-\d+$/.test(c.id)
    && c.country === 'US' && c.source === 'ODOT TripCheck'
    && typeof c.lat === 'number' && typeof c.lng === 'number'
    && Number.isFinite(c.lat) && Number.isFinite(c.lng)
    && c.lat >= OR_BOUNDS.minLat && c.lat <= OR_BOUNDS.maxLat
    && c.lng >= OR_BOUNDS.minLng && c.lng <= OR_BOUNDS.maxLng
    && typeof c.feed_url === 'string'
    && /^https:\/\/tripcheck\.com\/RoadCams\/cams\/[a-z0-9_.-]+$/i.test(c.feed_url)
    && typeof c.name === 'string' && typeof c.city === 'string';
}

async function readLastGood(): Promise<CctvCamera[]> {
  try {
    const raw = await readFile(BACKUP_FILE, 'utf8');
    if (raw.length > 3_000_000) return [];
    const snapshot = JSON.parse(raw) as { savedAt?: unknown; cameras?: unknown };
    if (typeof snapshot.savedAt !== 'number' || !Number.isFinite(snapshot.savedAt)
      || snapshot.savedAt > Date.now() || Date.now() - snapshot.savedAt > MAX_BACKUP_AGE_MS
      || !Array.isArray(snapshot.cameras) || snapshot.cameras.length > MAX_CAMERAS) return [];
    const cameras = snapshot.cameras.filter(validBackupCamera);
    // Reject a partially corrupt backup rather than silently misrepresenting it.
    return cameras.length === snapshot.cameras.length ? cameras : [];
  } catch { return []; }
}

async function persistLastGood(cameras: CctvCamera[]): Promise<void> {
  if (cameras.length === 0 || cameras.length > MAX_CAMERAS) return;
  try {
    await writeFile(BACKUP_FILE, JSON.stringify({ savedAt: Date.now(), cameras }), { mode: 0o600 });
  } catch {
    // Render's filesystem may be unavailable/read-only; the memory cache still works.
  }
}

/** A maximum of two bounded attempts, no 4xx retries and no uncontrolled fan-out. */
export async function loadOregonCameras(): Promise<CctvCamera[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // TripCheck responds with 406 to a JSON-specific Accept header.
      const res = await stealthFetch(INVENTORY, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: '*/*' },
      });
      if (!res.ok) {
        if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        throw new Error(`TripCheck HTTP ${res.status}`);
      }
      const raw = await res.text();
      if (raw.length > 5_000_000) throw new Error('TripCheck inventory too large');
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !Array.isArray((data as {features?: unknown}).features))
        throw new Error('TripCheck inventory is not a feature array');

      const cams: CctvCamera[] = [];
      const seen = new Set<string>();
      for (const feature of (data as {features: TripCheckFeature[]}).features) {
        const cam = mapFeature(feature);
        if (!cam || seen.has(cam.id)) continue;
        seen.add(cam.id);
        cams.push(cam);
        if (cams.length >= MAX_CAMERAS) break;
      }
      if (!cams.length) throw new Error('TripCheck inventory had no valid cameras');
      await persistLastGood(cams);
      console.log(`[OSIRIS] Oregon cameras — ODOT TripCheck: ${cams.length}`);
      return cams;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && transientUpstreamError(error)) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      break;
    }
  }

  const lastGood = await readLastGood();
  if (lastGood.length) {
    console.warn(`[OSIRIS] Oregon TripCheck unavailable — serving ${lastGood.length} last-good camera locations`);
    return lastGood;
  }
  throw lastError instanceof Error ? lastError : new Error('TripCheck unavailable; no usable backup');
}

export const fetchOregonCameras = cachedSource('oregon', loadOregonCameras);
