import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { stealthFetch } from '@/lib/stealthFetch';
import { loadOregonCameras, fetchOregonCameras, clearOregonCache } from './oregon';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
}));
vi.mock('@/lib/stealthFetch', () => ({ stealthFetch: vi.fn() }));

const row = {
  attributes: {
    cameraId: 277,
    filename: 'AstoriaUS101MeglerBrNB_pid392.jpg',
    latitude: 46.18785,
    longitude: -123.85347,
    route: 'US101',
    title: 'Astoria camera',
  },
};
const snapshotCam = {
  id: 'odot-277',
  lat: 46.18785,
  lng: -123.85347,
  name: 'Astoria camera',
  city: 'US101',
  country: 'US',
  feed_url: 'https://tripcheck.com/RoadCams/cams/AstoriaUS101MeglerBrNB_pid392.jpg',
  source: 'ODOT TripCheck',
};
function response(status: number, data: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
  } as Response;
}
function dnsFailure(): Error {
  const error = new TypeError('fetch failed') as TypeError & { cause?: unknown };
  error.cause = Object.assign(new Error('DNS temporarily unavailable'), { code: 'EAI_AGAIN' });
  return error;
}

describe('Oregon TripCheck bounded resilience', () => {
  beforeEach(() => {
    vi.mocked(stealthFetch).mockReset();
    vi.mocked(readFile).mockReset();
    vi.mocked(writeFile).mockReset();
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(rename).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
    clearOregonCache();
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
  });

  it('retries a transient DNS failure once then stores a verified inventory', async () => {
    vi.mocked(stealthFetch)
      .mockRejectedValueOnce(dnsFailure())
      .mockResolvedValueOnce(response(200, { features: [row] }));
    const cameras = await loadOregonCameras();
    expect(cameras).toMatchObject([{ id: 'odot-277', country: 'US' }]);
    expect(stealthFetch).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenCalledOnce();
    expect(rename).toHaveBeenCalledOnce();
  });

  it('retries HTTP 503 once but never retries HTTP 404', async () => {
    vi.mocked(stealthFetch)
      .mockResolvedValueOnce(response(503, {}))
      .mockResolvedValueOnce(response(200, { features: [row] }));
    expect((await loadOregonCameras())).toHaveLength(1);
    expect(stealthFetch).toHaveBeenCalledTimes(2);

    vi.mocked(stealthFetch).mockReset().mockResolvedValue(response(404, {}));
    await expect(loadOregonCameras()).rejects.toThrow('TripCheck HTTP 404');
    expect(stealthFetch).toHaveBeenCalledTimes(1);
  });

  it('returns only a recent validated last-good disk index after repeat DNS failure', async () => {
    vi.mocked(stealthFetch).mockRejectedValue(dnsFailure());
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      savedAt: Date.now() - 60_000,
      cameras: [snapshotCam],
    }));
    const cameras = await loadOregonCameras();
    expect(cameras).toEqual([snapshotCam]);
    expect(stealthFetch).toHaveBeenCalledTimes(2);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejects expired and malformed backups rather than inventing cameras', async () => {
    vi.mocked(stealthFetch).mockRejectedValue(dnsFailure());
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      savedAt: Date.now() - 8 * 24 * 60 * 60_000,
      cameras: [snapshotCam],
    }));
    await expect(loadOregonCameras()).rejects.toThrow('fetch failed');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      savedAt: Date.now() - 60_000,
      cameras: [{ ...snapshotCam, feed_url: 'https://attacker.example/cam' }],
    }));
    await expect(loadOregonCameras()).rejects.toThrow('fetch failed');
  });

  it('cooldowns empty fetches so repeated requests do not hammer failed DNS', async () => {
    vi.mocked(stealthFetch).mockRejectedValue(dnsFailure());
    expect(await fetchOregonCameras()).toEqual([]);
    expect(stealthFetch).toHaveBeenCalledTimes(2);
    expect(await fetchOregonCameras()).toEqual([]);
    expect(stealthFetch).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite the last complete backup with a partial response', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      savedAt: Date.now() - 1000,
      cameras: Array.from({ length: 100 }, (_, i) => ({ ...snapshotCam, id: 'odot-' + (1000 + i) })),
    }));
    vi.mocked(stealthFetch).mockResolvedValue(response(200, { features: [row] }));
    const cameras = await loadOregonCameras();
    expect(cameras).toHaveLength(100);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
