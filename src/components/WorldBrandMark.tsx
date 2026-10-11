'use client';

import { useId } from 'react';

type WorldBrandMarkProps = {
  variant?: 'hero' | 'header';
  className?: string;
};

/**
 * Shares APP's APEX emblem geometry (viewBox 200x118, core + observation /
 * decision wings) rather than WORLD's previous incompatible compass glyph.
 * The approved high-resolution feathered falcon remains a separate artwork
 * handoff; this is the current shared vector fallback.
 */
export default function WorldBrandMark({ variant = 'header', className = '' }: WorldBrandMarkProps) {
  const hero = variant === 'hero';
  const id = useId().replace(/:/g, '');
  const shell = `${id}-v5-shell`;
  const depth = `${id}-v5-depth`;
  const cyan = `${id}-v5-cyan`;
  const gold = `${id}-v5-gold`;
  const glow = `${id}-v5-glow`;
  const coreShell = 'M100 18 L134 38 L134 76 L100 98 L66 76 L66 38 Z';

  return (
    <div dir="ltr" aria-label="M3TM.WORLD"
      className={`inline-flex items-center bg-transparent select-none ${hero ? 'gap-3.5' : 'gap-2.5'} ${className}`}>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 200 118"
        className={`${hero ? 'w-[120px] h-[80px] md:w-[132px] md:h-[88px]' : 'w-[74px] h-[48px] md:w-[82px] md:h-[54px]'} shrink-0 overflow-visible`}>
        <defs>
          <linearGradient id={shell} x1="0" y1="0" x2=".6" y2="1">
            <stop offset="0" stopColor="#dbe8eb" />
            <stop offset=".5" stopColor="#71878e" />
            <stop offset="1" stopColor="#d3e0e2" />
          </linearGradient>
          <linearGradient id={depth} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#19343b" />
            <stop offset="1" stopColor="#08141a" />
          </linearGradient>
          <linearGradient id={cyan} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#76ceeb" stopOpacity=".1" />
            <stop offset="1" stopColor="#76ceeb" stopOpacity=".72" />
          </linearGradient>
          <linearGradient id={gold} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#d4af6b" stopOpacity=".12" />
            <stop offset="1" stopColor="#d4af6b" stopOpacity=".76" />
          </linearGradient>
          <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.45" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d="M14 34 H46 L70 46 V68 L46 80 H14 Z" fill={`url(#${cyan})`} opacity=".34" />
        <path d="M186 34 H154 L130 46 V68 L154 80 H186 Z" fill={`url(#${gold})`} opacity=".3" />
        <g fill="none" stroke="#76ceeb" strokeWidth="1.7" strokeLinecap="round" opacity=".82">
          <path d="M12 30 H38 L58 42 M12 59 H50 L68 57 M12 88 H38 L58 72" />
          <circle cx="22" cy="30" r="2.2" /><circle cx="30" cy="88" r="2.2" />
        </g>
        <g fill="none" stroke="#d4af6b" strokeWidth="1.7" strokeLinecap="round" opacity=".82">
          <path d="M142 42 L162 30 H188 M132 57 H150 H188 M142 72 L162 88 H188" />
          <circle cx="178" cy="30" r="2.2" /><circle cx="170" cy="88" r="2.2" />
        </g>
        <path d="M102 21 L136 41 L136 73 L102 95 L66 73 L66 41 Z" fill={`url(#${depth})`} />
        <path d={coreShell} fill={`url(#${shell})`} stroke="#d7e7e9" strokeWidth="1.1" />
        <path d="M100 30 L122 43 L122 71 L100 85 L78 71 L78 43 Z" fill="#0a1c22" stroke="#50727a" strokeWidth="1" />
        <path d="M100 42 L115 57 L100 72 L85 57 Z" fill="#d4af6b" stroke="#071116" strokeWidth="1.15" filter={`url(#${glow})`} />
        <path d="M12 59 H50 L70 57" fill="none" stroke="#76ceeb" strokeWidth="2.8" strokeLinecap="round" opacity=".55" />
        <path d="M130 57 H150 H188" fill="none" stroke="#d4af6b" strokeWidth="2.8" strokeLinecap="round" opacity=".55" />
        <path d="M10 108 H190" fill="none" stroke="#76ceeb" strokeWidth="1.5" strokeDasharray="18 120" opacity=".5" />
      </svg>

      <div className="flex min-w-0 flex-col justify-center leading-none">
        <div className={`${hero ? 'text-[34px] md:text-[42px]' : 'text-[17px] md:text-[21px]'} whitespace-nowrap font-bold tracking-[0.035em]`}
          style={{ textShadow: '0 1px 16px rgba(212,175,107,0.16)' }}>
          <span className="text-[#D4AF6B]">M3TM</span>
          <span className="text-[#F5F1E8]">.WORLD</span>
        </div>
        {hero && (
          <div dir="rtl" className="mt-1.5 whitespace-nowrap text-[9px] font-medium tracking-[0.055em] text-[#D8D2C4]/80 md:text-[10px]">
            ذكاء واحد · عالم أوسع
          </div>
        )}
      </div>
    </div>
  );
}
