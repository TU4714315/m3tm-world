'use client';

import { useId } from 'react';

type M3tmApexBrandProps = {
  compact?: boolean;
  className?: string;
  markClassName?: string;
  subtitle?: string;
};

/**
 * M3TM APEX — canonical orbit geometry shared with M3TM.APP BrandMark.
 * Keep these paths byte-for-byte aligned with the APP orbit form:
 * shell M100 18… / depth M102 21… / channel M100 30… / core M100 42….
 */
export default function M3tmApexBrand({
  compact = false,
  className = '',
  markClassName = '',
  subtitle,
}: M3tmApexBrandProps) {
  const id = useId().replace(/:/g, '');
  const shellId = `${id}-shell`;
  const depthId = `${id}-depth`;
  const cyanId = `${id}-cyan`;
  const goldId = `${id}-gold`;
  const glowId = `${id}-glow`;

  return (
    <div
      className={`inline-flex items-center gap-2.5 ${className}`}
      dir="ltr"
      aria-label="M3TM.WORLD"
    >
      <span className={`relative inline-flex shrink-0 items-center justify-center ${markClassName}`} aria-hidden="true">
        <span
          className="absolute inset-[16%] rounded-full opacity-70 blur-xl"
          style={{ background: 'radial-gradient(circle, rgba(38,215,218,.13), rgba(212,175,55,.07) 48%, transparent 72%)' }}
        />
        <svg
          className="relative h-full w-full overflow-visible"
          viewBox="0 0 200 118"
          focusable="false"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={shellId} x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0" stopColor="#dbe8eb" />
              <stop offset="0.5" stopColor="#71878e" />
              <stop offset="1" stopColor="#d3e0e2" />
            </linearGradient>
            <linearGradient id={depthId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#19343b" />
              <stop offset="1" stopColor="#08141a" />
            </linearGradient>
            <linearGradient id={cyanId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--cyan-primary)" stopOpacity="0.1" />
              <stop offset="1" stopColor="var(--cyan-primary)" stopOpacity="0.72" />
            </linearGradient>
            <linearGradient id={goldId} x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="var(--gold-primary)" stopOpacity="0.12" />
              <stop offset="1" stopColor="var(--gold-primary)" stopOpacity="0.76" />
            </linearGradient>
            <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.45" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d="M14 34 H46 L70 46 V68 L46 80 H14 Z" fill={`url(#${cyanId})`} />
          <path d="M186 34 H154 L130 46 V68 L154 80 H186 Z" fill={`url(#${goldId})`} />

          <g fill="none" stroke="var(--cyan-primary)" strokeWidth="1.7" strokeLinecap="round" opacity="0.84">
            <path d="M12 30 H38 L58 42" />
            <path d="M12 59 H50 L68 57" />
            <path d="M12 88 H38 L58 72" />
            <circle cx="22" cy="30" r="2.2" />
            <circle cx="30" cy="88" r="2.2" />
          </g>
          <g fill="none" stroke="var(--gold-primary)" strokeWidth="1.7" strokeLinecap="round" opacity="0.84">
            <path d="M142 42 L162 30 H188" />
            <path d="M132 57 H150 H188" />
            <path d="M142 72 L162 88 H188" />
            <circle cx="178" cy="30" r="2.2" />
            <circle cx="170" cy="88" r="2.2" />
          </g>

          <path d="M102 21 L136 41 L136 73 L102 95 L66 73 L66 41 Z" fill={`url(#${depthId})`} />
          <path d="M100 18 L134 38 L134 76 L100 98 L66 76 L66 38 Z" fill={`url(#${shellId})`} />
          <path d="M100 30 L122 43 L122 71 L100 85 L78 71 L78 43 Z" fill="#0d2026" stroke="#304b53" strokeWidth="1.5" />
          <path d="M100 42 L115 57 L100 72 L85 57 Z" fill="var(--gold-primary)" filter={`url(#${glowId})`} />

          <path d="M12 59 H50 L70 57" fill="none" stroke="var(--cyan-primary)" strokeWidth="2.8" strokeLinecap="round" filter={`url(#${glowId})`} />
          <path d="M130 57 H150 H188" fill="none" stroke="var(--gold-primary)" strokeWidth="2.8" strokeLinecap="round" filter={`url(#${glowId})`} />
        </svg>
      </span>

      {!compact && (
        <span className="min-w-0 text-left">
          <span className="block whitespace-nowrap font-mono text-[clamp(15px,2.1vw,24px)] font-black tracking-[0.08em] text-[var(--text-primary)]">
            M3TM.<span className="text-[var(--gold-primary)]">WORLD</span>
          </span>
          {subtitle && (
            <span dir="rtl" className="mt-0.5 block whitespace-nowrap text-[clamp(8px,1.15vw,11px)] tracking-[0.04em] text-[var(--text-secondary)]">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
