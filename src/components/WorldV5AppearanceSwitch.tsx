'use client';

import { useEffect, useState } from 'react';
import { Moon, MoonStar, SunMedium } from 'lucide-react';

export type WorldV5Appearance = 'dark' | 'light' | 'midnight';

const KEY = 'm3tm:v5:theme:world';
const isAppearance = (value: unknown): value is WorldV5Appearance =>
  value === 'dark' || value === 'light' || value === 'midnight';

/**
 * Appearance switches only the surrounding WORLD interface; MapLibre source,
 * tile styling, overlays, and published source data stay unchanged.
 */
export default function WorldV5AppearanceSwitch() {
  const [appearance, setAppearance] = useState<WorldV5Appearance>('dark');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (isAppearance(stored)) setAppearance(stored);
    } catch {
      // Private browsing does not prevent theme switching in this session.
    }
  }, []);

  useEffect(() => {
    document.body.dataset.m3tmWorldAppearance = appearance;
    try {
      window.localStorage.setItem(KEY, appearance);
    } catch {
      // Browser preference only; not an authorization source.
    }
    return () => { delete document.body.dataset.m3tmWorldAppearance; };
  }, [appearance]);

  const modes = [
    { value: 'dark', label: 'داكن فاخر', Icon: Moon },
    { value: 'light', label: 'فاتح', Icon: SunMedium },
    { value: 'midnight', label: 'أزرق ليلي', Icon: MoonStar },
  ] as const;

  return (
    <div dir="rtl" className="m3tm-world-v5-switcher pointer-events-auto" role="group" aria-label="نمط واجهة WORLD">
      {modes.map(({ value, label, Icon }) => (
        <button key={value} type="button" aria-pressed={appearance === value}
          aria-label={label} title={label}
          className={appearance === value ? 'is-active' : ''}
          onClick={() => setAppearance(value)}>
          <Icon size={15} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
