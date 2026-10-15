import type { MapAccessGrant } from '@/components/MapAccessGate';

/** Serialize cookie writes. A logout DELETE must follow every older POST. */
export function createMapMemberExchange(callbacks: {
  mode: () => string; blockResume: () => void;
  accept: (grant: MapAccessGrant) => void; deny: () => void;
}) {
  let generation = 0;
  let pendingWrites = 0;
  let tail: Promise<void> = Promise.resolve();
  const remove = async () => { await fetch('/api/map-access', { method: 'DELETE' }); };
  return {
    receive(accessToken: unknown) {
      const current = ++generation;
      if (!accessToken) {
        const mustDelete = callbacks.mode() === 'member' || pendingWrites > 0;
        callbacks.blockResume();
        if (mustDelete) tail = tail.catch(() => {}).then(remove).catch(() => {});
        return tail;
      }
      if (typeof accessToken !== 'string' || accessToken.length > 2048) return tail;
      pendingWrites++;
      tail = tail.catch(() => {}).then(async () => {
        if (current !== generation) return;
        const response = await fetch('/api/map-access', { method: 'POST', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken }) });
        if (current !== generation) return;
        if (!response.ok) { callbacks.deny(); await remove(); return; }
        const grant = await response.json();
        if (current === generation) callbacks.accept(grant);
      }).catch(async () => { if (current === generation) { callbacks.deny(); await remove().catch(() => {}); } })
        .finally(() => { pendingWrites--; });
      return tail;
    },
    dispose() { generation++; },
  };
}
