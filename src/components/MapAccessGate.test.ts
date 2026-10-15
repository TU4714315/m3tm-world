import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MapAccessGate, { requestMapAccess } from './MapAccessGate';

afterEach(() => vi.unstubAllGlobals());

describe('map invitation access gate', () => {
  it('provides an explicitly named private code input without URL-based submission', () => {
    const html = renderToStaticMarkup(createElement(MapAccessGate, { onAccess: vi.fn(), onClose: vi.fn() }));
    expect(html).toContain('كود الدعوة');
    expect(html).toContain('type="password"');
    expect(html).toContain('name="code"');
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain('method="get"');
  });
  it('posts the code only in the request body and returns the validated access grant', async () => {
    const grant = { accessToken: 'test-session-token', expiresAt: '2026-10-20T00:00:00Z', accessMode: 'guest' };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(grant)));
    vi.stubGlobal('fetch', fetchMock);
    expect(await requestMapAccess('  invitation-example  ')).toEqual(grant);
    expect(fetchMock).toHaveBeenCalledWith('/api/map-access', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ code: 'invitation-example' }), cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    }));
  });
  it('never reflects a server error body or accepts malformed grants as access', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private server detail', { status: 403 })));
    await expect(requestMapAccess('invalid-example')).rejects.toThrow('تعذر قبول كود الدعوة');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ accessToken: 'token', expiresAt: 'invalid', accessMode: 'guest' }))));
    await expect(requestMapAccess('invalid-example')).rejects.toThrow('Invalid grant');
  });
  it('returns a bounded retry message when attempts are rate limited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(requestMapAccess('example')).rejects.toThrow('محاولات كثيرة');
  });
});
