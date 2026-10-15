import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('public deployment identity', () => {
  it.each([
    ['render-sha', 'vercel-sha', 'render-sha'],
    ['', 'vercel-sha', 'vercel-sha'],
    ['', '', null],
  ])('reports the running host commit without a deep network probe', async (render, vercel, expected) => {
    vi.stubEnv('RENDER_GIT_COMMIT', render);
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', vercel);
    const network = vi.fn(() => { throw new Error('unexpected network probe'); });
    vi.stubGlobal('fetch', network);
    const response = await GET(new Request('https://world.example/api/health'));
    const health = await response.json();
    expect(response.status).toBe(200);
    expect(health.deployment.sha).toBe(expected);
    expect(health.deepProbe).toBe(false);
    expect(network).not.toHaveBeenCalled();
  });
});
