'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LockKeyhole, X } from 'lucide-react';

export interface MapAccessGrant {
  accessToken: string;
  expiresAt: string | number;
  accessMode: string;
}

interface MapAccessGateProps {
  onAccess: (grant: MapAccessGrant) => void;
  onClose?: () => void;
}

class MapAccessRequestError extends Error {}

export async function requestMapAccess(code: string, signal?: AbortSignal): Promise<MapAccessGrant> {
  const response = await fetch('/api/map-access', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }), cache: 'no-store', signal,
  });
  if (!response.ok) throw new MapAccessRequestError(response.status === 429
    ? 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.'
    : 'تعذر قبول كود الدعوة. تحقّق منه وأعد المحاولة.');
  const grant: unknown = await response.json();
  if (!grant || typeof grant !== 'object') throw new Error('Invalid grant');
  const value = grant as Record<string, unknown>;
  if (typeof value.accessToken !== 'string' || !value.accessToken
    || typeof value.accessMode !== 'string' || !value.accessMode
    || !(typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt))
      || typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt))) throw new Error('Invalid grant');
  return { accessToken: value.accessToken, expiresAt: value.expiresAt, accessMode: value.accessMode };
}

export default function MapAccessGate({ onAccess, onClose }: MapAccessGateProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    inputRef.current?.focus();
    return () => {
      requestRef.current?.abort();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  const close = () => {
    requestRef.current?.abort();
    setCode('');
    onClose?.();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !code.trim()) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setError('');
    setBusy(true);
    try {
      const grant = await requestMapAccess(code, controller.signal);
      if (controller.signal.aborted) return;
      setCode('');
      onAccess(grant);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof MapAccessRequestError ? failure.message : 'تعذر الاتصال. أعد المحاولة بعد قليل.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#03080d]/75 p-4 backdrop-blur-md">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="map-access-title" aria-describedby="map-access-description" dir="rtl"
      onKeyDown={event => {
        if (event.key === 'Escape' && onClose) { event.preventDefault(); close(); }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      className="relative w-full max-w-sm rounded-2xl border border-cyan-100/20 bg-[#0b1824]/90 p-5 text-slate-100 shadow-[0_24px_100px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.08)]">
      {onClose && <button type="button" onClick={close} aria-label="إغلاق كود الدعوة" className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-100"><X aria-hidden="true" className="h-4 w-4" /></button>}
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100/20 bg-cyan-100/[0.06]"><LockKeyhole aria-hidden="true" className="h-5 w-5 text-cyan-100" /></div>
      <h2 id="map-access-title" className="text-lg font-semibold">كود الدعوة</h2>
      <p id="map-access-description" className="mt-2 text-xs leading-6 text-slate-400">أدخل كود الدعوة لفتح الطبقات والبث والأخبار الحديثة المتاحة لك.</p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <label htmlFor="map-invitation-code" className="block text-xs text-slate-200">كود الدعوة</label>
        <input ref={inputRef} id="map-invitation-code" name="code" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false}
          value={code} onChange={event => { setCode(event.target.value); setError(''); }} maxLength={160} required disabled={busy}
          aria-invalid={!!error} aria-describedby={error ? 'map-access-error' : undefined}
          className="min-h-11 w-full rounded-xl border border-cyan-100/25 bg-black/15 px-3 text-left text-sm tracking-wider outline-none focus:border-cyan-100/70 disabled:opacity-60" dir="ltr" />
        {error && <p id="map-access-error" role="alert" className="text-xs leading-6 text-amber-100">{error}</p>}
        <button type="submit" disabled={busy || !code.trim()} className="min-h-11 w-full rounded-xl border border-cyan-100/35 bg-cyan-100/10 px-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-100/15 focus-visible:ring-2 focus-visible:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'جارٍ التحقق…' : 'فتح الوصول'}</button>
      </form>
    </div>
  </div>;
}
