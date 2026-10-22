import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReferenceAtlasSnapshot, readReferenceAtlasSnapshot } from '@/lib/iswnAtlasServer';
import { GET } from './route';

vi.mock('@/lib/iswnAtlasServer', () => ({ getReferenceAtlasSnapshot: vi.fn(), readReferenceAtlasSnapshot: vi.fn() }));
const collectorToken = 'collector-fixture-only-credential-0000000000';
beforeEach(() => {
  vi.stubEnv('WORLD_MAP_REFRESH_TOKEN', collectorToken);
  vi.mocked(getReferenceAtlasSnapshot).mockReset().mockResolvedValue({
    version: 1, provider: 'iswn', status: 'ok', contentKind: 'reference_annotations',
    features: { type: 'FeatureCollection', features: [] }, layers: [], featureCount: 0,
    sourceUrl: '', publisherUrl: '', fetchedAt: null, checkedAt: null, nextRefreshAt: null,
    sourcePublishedAt: null, refreshReason: null, changes: null, cacheBackend: 'memory', bulletins: [], error: null,
  });
  vi.mocked(readReferenceAtlasSnapshot).mockReset().mockImplementation(
    () => vi.mocked(getReferenceAtlasSnapshot).getMockImplementation()!(),
  );
});
afterEach(() => vi.unstubAllEnvs());

describe('reference atlas collector event boundary', () => {
  it('does not allow a guest viewing grant to force a refresh', async () => {
    const response = await GET(new Request('https://example.test/api/reference-atlas', {
      headers: { Authorization: 'Bearer guest-fixture-grant', 'X-M3TM-Atlas-Event-Id': 'event:one' },
    }));
    expect(response.status).toBe(403);
    expect(getReferenceAtlasSnapshot).not.toHaveBeenCalled();
  });
  it('passes an explicit event id only for the dedicated collector credential', async () => {
    const response = await GET(new Request('https://example.test/api/reference-atlas', {
      headers: { Authorization: `Bearer ${collectorToken}`, 'X-M3TM-Atlas-Collect': '1', 'X-M3TM-Atlas-Event-Id': 'event:one' },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(getReferenceAtlasSnapshot).toHaveBeenCalledWith('event:one', false);
  });
  it('rejects URL-shaped event signals and ignores public force/provider query strings', async () => {
    const rejected = await GET(new Request('https://example.test/api/reference-atlas', {
      headers: { Authorization: `Bearer ${collectorToken}`, 'X-M3TM-Atlas-Collect': '1', 'X-M3TM-Atlas-Event-Id': 'https://other.test/map' },
    }));
    expect(rejected.status).toBe(400);
    expect(getReferenceAtlasSnapshot).not.toHaveBeenCalled();
    await GET(new Request('https://example.test/api/reference-atlas?force=1&event_id=event:one&url=https://other.test'));
    expect(getReferenceAtlasSnapshot).not.toHaveBeenCalled();
    expect(readReferenceAtlasSnapshot).toHaveBeenCalledTimes(1);
  });
  it('does not allow collector refresh through an ordinary guest read', async () => {
    const response = await GET(new Request('https://example.test/api/reference-atlas'));
    expect(response.status).toBe(200);
    expect(readReferenceAtlasSnapshot).toHaveBeenCalledTimes(1);
    expect(getReferenceAtlasSnapshot).not.toHaveBeenCalled();
  });
  it('permits a force refresh only with a collector credential and explicit intent', async () => {
    const unauthorized = await GET(new Request('https://example.test/api/reference-atlas', {
      headers: { 'X-M3TM-Atlas-Collect': '1', 'X-M3TM-Atlas-Force': '1' },
    }));
    expect(unauthorized.status).toBe(403);
    const authorized = await GET(new Request('https://example.test/api/reference-atlas', {
      headers: { Authorization: `Bearer ${collectorToken}`, 'X-M3TM-Atlas-Collect': '1', 'X-M3TM-Atlas-Force': '1' },
    }));
    expect(authorized.status).toBe(200);
    expect(getReferenceAtlasSnapshot).toHaveBeenCalledWith(undefined, true);
  });
});
