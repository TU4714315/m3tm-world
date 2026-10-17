'use client';

import { useEffect, useState } from 'react';

/** Pure policy: never report a timeout while the map is ready or tab hidden. */
export function isMapStartupDelayDue(ready: boolean, visible: boolean, elapsedMs: number, waitMs: number): boolean {
  return !ready && visible && elapsedMs >= waitMs;
}

/**
 * Covers failures that occur *before* the lazy WorldMap chunk mounts, when
 * MapLibre's own error UI cannot exist. The map keeps loading in the background
 * and may still recover; the user controls any expensive remount.
 */
export default function MapStartupWatchdog({
  ready,
  attempt,
  onRetry,
  waitMs = 45_000,
}: {
  ready: boolean;
  attempt: number;
  onRetry: () => void;
  waitMs?: number;
}) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    if (ready) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const pauseWhenHidden = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      if (!document.hidden) timeoutId = setTimeout(() => setTimedOut(isMapStartupDelayDue(ready, !document.hidden, waitMs, waitMs)), waitMs);
    };
    pauseWhenHidden();
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', pauseWhenHidden);
    };
  }, [ready, attempt, waitMs]);

  if (ready || !timedOut) return null;
  return (
    <div dir="rtl" role="alert" data-testid="m3tm-world-startup-delayed"
      className="pointer-events-none absolute inset-0 z-[320] flex items-center justify-center p-4">
      <div className="pointer-events-auto max-w-sm rounded-xl border border-amber-400/35 bg-[#07111f]/95 p-5 text-center text-slate-100 shadow-xl">
        <strong className="block text-base">تأخر تهيئة الخريطة</strong>
        <p className="mt-2 text-sm text-slate-300">
          لم تصبح الخريطة جاهزة بعد. قد يكون تحميل موارد الرسم بطيئًا؛ لم تُعتمد بيانات جديدة لإخفاء المشكلة.
        </p>
        <button type="button" onClick={onRetry}
          className="mt-4 min-h-11 rounded-lg border border-cyan-300/50 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10">
          إعادة تهيئة الخريطة
        </button>
      </div>
    </div>
  );
}
