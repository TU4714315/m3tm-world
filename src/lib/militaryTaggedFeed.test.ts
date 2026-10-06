import { describe, expect, it, vi } from 'vitest';
import { fetchTaggedMilitaryFeed, TAGGED_FEED_BACKUP, TAGGED_FEED_PRIMARY } from './militaryTaggedFeed';

const ok = (ac: unknown[]) => new Response(JSON.stringify({ ac }), { status: 200 });

describe('server-only tagged ADS-B provider and controlled fallback', () => {
  it('uses ADSB.lol without forged IP headers or unnecessary requests', async () => {
    const fn = vi.fn(async (_url: string, _init?: RequestInit) => ok([{ hex: 'sample' }]));
    const feed = await fetchTaggedMilitaryFeed(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe(TAGGED_FEED_PRIMARY);
    expect(fn.mock.calls[0][1]?.headers).toEqual({
      Accept: 'application/json',
      'User-Agent': 'M3TM-WORLD/1.0 (+https://m3tm-world.vercel.app)',
    });
    expect(feed).toMatchObject({ provider: 'adsb.lol', primaryState: 'active', backupState: 'not_requested', primaryCount: 1 });
  });
  it('does not use non-commercial backup by default on HTTP 403', async () => {
    const fn = vi.fn(async () => new Response('Forbidden', { status: 403 }));
    expect(await fetchTaggedMilitaryFeed(fn)).toMatchObject({ provider: null, aircraft: [], backupState: 'not_requested' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect((await fetchTaggedMilitaryFeed(async () => new Response('Forbidden', {status:403}))).primaryHttpStatus).toBe(403);
  });
  it('does not treat a successful empty array as observed absence', async () => {
    const fn = vi.fn(async () => ok([]));
    expect(await fetchTaggedMilitaryFeed(fn)).toMatchObject({ provider: null, primaryState: 'empty' });
  });
  it('uses ADSB.fi only when explicitly enabled for the licensed use', async () => {
    const fn = vi.fn(async (url: string) => url === TAGGED_FEED_PRIMARY ? ok([]) : ok([{ hex: 'sample' }]));
    const result = await fetchTaggedMilitaryFeed(fn, { backupEnabled: true });
    expect(fn.mock.calls[1][0]).toBe(TAGGED_FEED_BACKUP);
    expect(result).toMatchObject({ provider: 'adsb.fi', primaryState: 'empty', backupState: 'active', backupCount: 1 });
  });
  it('does not fabricate observations if both feeds fail', async () => {
    const fn = vi.fn(async () => new Response(null, { status: 429 }));
    expect(await fetchTaggedMilitaryFeed(fn, { backupEnabled: true })).toMatchObject({
      provider: null, aircraft: [], primaryState: 'unavailable', backupState: 'unavailable'
    });
  });
});
