import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapMemberExchange } from './mapMemberExchange';
afterEach(() => vi.unstubAllGlobals());
describe('member identity cookie ordering', () => {
  it('deletes after an old POST resolves and never accepts the logged-out grant', async () => {
    let finish!: (response: Response) => void;
    const fetcher=vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}))
      .mockResolvedValue(Response.json({cleared:true}));
    vi.stubGlobal('fetch',fetcher);
    const callbacks={mode:()=>'',blockResume:vi.fn(),accept:vi.fn(),deny:vi.fn()};
    const exchange=createMapMemberExchange(callbacks);
    void exchange.receive('a'.repeat(80));
    await Promise.resolve(); await Promise.resolve();
    const loggedOut=exchange.receive(null);
    expect(callbacks.blockResume).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(1);
    finish(Response.json({accessToken:'stale-grant',accessMode:'member',expiresAt:'2099-01-01'}));
    await loggedOut;
    expect(callbacks.accept).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.map(call=>call[1]?.method)).toEqual(['POST','DELETE']);
  });
  it('preserves an established guest session when the APP parent has no member', async () => {
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const blockResume=vi.fn();
    const exchange=createMapMemberExchange({mode:()=> 'guest',blockResume,accept:vi.fn(),deny:vi.fn()});
    await exchange.receive(null);
    expect(blockResume).toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
  });
});
