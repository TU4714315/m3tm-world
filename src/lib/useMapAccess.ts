'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapAccessGrant } from '@/components/MapAccessGate';
import { shouldPollMapAccess } from './mapAccessPollPolicy';

export function useMapAccess() {
  const [hasMapAccess, setAllowed] = useState(false);
  const [revision, setRevision] = useState(0);
  const token = useRef('');
  const mode = useRef('');
  const expiry = useRef(0);
  const sequence = useRef(0);
  const memberBlocked = useRef(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    sequence.current++; token.current = ''; expiry.current = 0; mode.current = '';
    setAllowed(false); setRevision(value => value + 1);
  }, []);
  const accept = useCallback((grant: MapAccessGrant) => {
    const deadline = typeof grant.expiresAt === 'string' ? Date.parse(grant.expiresAt) : grant.expiresAt;
    if (!Number.isFinite(deadline) || deadline <= Date.now()) { clear(); return; }
    sequence.current++; token.current = grant.accessToken; expiry.current = deadline; mode.current = grant.accessMode;
    if (grant.accessMode === 'member') memberBlocked.current = false;
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = setTimeout(clear, Math.max(0, deadline - Date.now()));
    setAllowed(true); setRevision(value => value + 1);
  }, [clear]);
  const blockMemberResume = useCallback(() => {
    memberBlocked.current = true;
    if (mode.current !== 'guest') clear();
  }, [clear]);
  const headers = useCallback((): Record<string, string> => token.current ? { Authorization: `Bearer ${token.current}` } : {}, []);
  useEffect(() => {
    let disposed = false;
    let lastAnonymousCheck = Date.now();
    const check = async () => {
      const started = sequence.current;
      try {
        const response = await fetch('/api/map-access', { cache: 'no-store', headers: headers(), signal: AbortSignal.timeout(10_000) });
        const body = response.ok ? await response.json() : null;
        if (disposed || started !== sequence.current) return;
        if (body?.accessMode === 'member' && memberBlocked.current) {
          clear(); void fetch('/api/map-access', { method: 'DELETE' }); return;
        }
        if (!body || !['guest', 'member'].includes(body.accessMode) || !(Date.parse(body.expiresAt) > Date.now())) {
          if (expiry.current) clear();
          return;
        }
        expiry.current = Date.parse(body.expiresAt); mode.current = body.accessMode; setAllowed(true);
        if (expiryTimer.current) clearTimeout(expiryTimer.current);
        expiryTimer.current = setTimeout(clear, Math.max(0, expiry.current - Date.now()));
      } catch { if (!disposed && started === sequence.current && expiry.current) clear(); }
    };
    void check();
    const timer = setInterval(() => {
      if (expiry.current && expiry.current <= Date.now()) {
        clear();
        return;
      }
      const now = Date.now();
      const hasGrant = expiry.current > 0 || Boolean(token.current);
      if (!shouldPollMapAccess(hasGrant, document.hidden, now, lastAnonymousCheck)) return;
      if (!hasGrant) lastAnonymousCheck = now;
      void check();
    }, 10_000);
    return () => { disposed = true; clearInterval(timer); if (expiryTimer.current) clearTimeout(expiryTimer.current); };
  }, [clear, headers]);
  return { hasMapAccess, revision, accessModeRef: mode, blockMemberResume, acceptMapAccess: accept, clearMapAccess: clear, mapAccessHeaders: headers };
}
