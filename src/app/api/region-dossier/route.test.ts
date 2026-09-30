import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpJson = vi.fn();
vi.mock('@/lib/httpJson', () => ({ httpJson: (...args: unknown[]) => httpJson(...args) }));

import { amountOf, current, itemId, placeAt, stillHolding, type WdStatement } from './route';

const ended = (id: string, rank?: string): WdStatement => ({
  rank,
  qualifiers: [{ property: { id: 'P580' } }, { property: { id: 'P582' } }],
  value: { content: id },
});
const holds = (id: string, rank?: string): WdStatement => ({
  rank,
  qualifiers: [{ property: { id: 'P580' } }],
  value: { content: id },
});

describe('Region Dossier current Wikidata statements', () => {
  it('skips office holders whose statement has ended', () => {
    expect(itemId(current([ended('old'), holds('current')]))).toBe('current');
  });
  it('prefers Wikidata preferred rank', () => {
    expect(itemId(current([holds('first'), holds('preferred', 'preferred')]))).toBe('preferred');
  });
  it('keeps all still-current languages', () => {
    expect(stillHolding([holds('en'), holds('ms'), ended('old')]).map(itemId)).toEqual(['en','ms']);
  });
  it('reads quantities without emitting NaN', () => {
    expect(amountOf({ value: { content: { amount: '+41167335' } } } as WdStatement)).toBe(41167335);
    expect(amountOf({ value: { content: 'Q1' } })).toBeUndefined();
  });
});

describe('Region Dossier Photon reverse lookup', () => {
  const tokyo = { features: [{ properties: { city: 'Tokyo', country: 'Japan', countrycode: 'jp' } }] };
  beforeEach(() => httpJson.mockReset());

  it('retries once after a transient failure', async () => {
    httpJson.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce(tokyo);
    expect(await placeAt(35.681, 139.691)).toMatchObject({ city: 'Tokyo', country: 'Japan' });
    expect(httpJson).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed lookup', async () => {
    httpJson.mockRejectedValue(new Error('503'));
    expect(await placeAt(35.682, 139.692)).toBeNull();
    httpJson.mockReset().mockResolvedValue(tokyo);
    expect(await placeAt(35.682, 139.692)).toMatchObject({ city: 'Tokyo' });
  });

  it('caches a valid answer at the same rounded coordinate', async () => {
    httpJson.mockResolvedValue(tokyo);
    await placeAt(35.6834, 139.6934);
    await placeAt(35.68349, 139.69349);
    expect(httpJson).toHaveBeenCalledTimes(1);
  });

  it('uses a 50 km reverse radius for sparse land and does not retry a valid empty sea result', async () => {
    httpJson.mockResolvedValue({ features: [] });
    expect(await placeAt(0, -30)).toBeNull();
    expect(String(httpJson.mock.calls[0][0])).toContain('radius=50');
    expect(httpJson).toHaveBeenCalledTimes(1);
  });
});
