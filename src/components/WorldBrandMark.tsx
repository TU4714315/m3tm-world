'use client';

import { useId } from 'react';
import Image from 'next/image';

type WorldBrandMarkProps = {
  variant?: 'hero' | 'header';
  className?: string;
};

/**
 * Shares APP V5's layered metallic falcon emblem geometry (viewBox 200x118)
 * rather than WORLD's earlier incompatible hexagon/compass signatures.
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
  const coreShell = 'M100 42 C109 42 122 54 124 65 C118 78 108 93 100 106 C92 93 82 78 76 65 C78 54 91 42 100 42 Z';

  return (
    <div dir="ltr" aria-label="M3TM.WORLD"
      className={`inline-flex items-center bg-transparent select-none ${hero ? 'gap-3.5' : 'gap-2.5'} ${className}`}>
      <span className="relative inline-flex shrink-0">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 200 118"
        className={`${hero ? 'w-[120px] h-[80px] md:w-[132px] md:h-[88px]' : 'w-[74px] h-[48px] md:w-[82px] md:h-[54px]'} shrink-0 overflow-visible opacity-0`}>
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

        {/* Same symmetrical five-feather falcon topology as APP's V5 mark. */}
        {[false, true].map(mirrored => (
          <g key={String(mirrored)} transform={mirrored ? 'translate(200 0) scale(-1 1)' : undefined}>
            <path d="M99 65 C78 42 40 16 8 13 C15 42 44 72 81 84 L99 84 Z" fill={`url(#${cyan})`} opacity=".34" />
            <path d="M97 58 C75 36 43 17 14 10 C17 29 37 46 65 59 Q83 68 99 73 Z" fill={`url(#${shell})`} opacity=".96" />
            <path d="M96 67 C70 48 41 34 12 28 C18 46 37 59 65 71 L97 80 Z" fill={`url(#${gold})`} opacity=".98" />
            <path d="M93 72 C66 58 39 47 15 42 C23 59 44 73 70 82 L99 83 Z" fill={`url(#${cyan})`} opacity=".98" />
            <path d="M91 76 C70 68 46 61 25 58 C36 75 59 85 82 88 L99 84 Z" fill={`url(#${shell})`} opacity=".9" />
            <path d="M95 82 C73 79 53 74 38 71 C52 87 73 92 91 91 L100 86 Z" fill={`url(#${gold})`} opacity=".91" />
            <g fill="none" stroke="#D4AF6B" strokeWidth="1.15" strokeLinecap="round" opacity=".77">
              <path d="M16 16 C42 26 67 44 95 65" />
              <path d="M21 35 C43 44 67 57 94 73" />
              <path d="M27 55 C49 63 72 74 97 82" />
            </g>
          </g>
        ))}
        <path d="M100 39 C112 42 125 54 126 66 C121 83 109 97 100 113 C91 97 79 83 74 66 C75 54 88 42 100 39 Z" fill={`url(#${depth})`} />
        <path d={coreShell} fill={`url(#${shell})`} stroke="#d7e7e9" strokeWidth="1.1" />
        <path d="M100 49 C109 50 116 59 117 67 C110 76 104 84 100 95 C96 84 90 76 83 67 C84 59 91 50 100 49 Z" fill="#0a1c22" stroke="#50727a" strokeWidth="1" />
        <path d="M100 53 L112 68 L100 99 L88 68 Z" fill="#d4af6b" stroke="#071116" strokeWidth="1.15" filter={`url(#${glow})`} />
        <path d="M10 108 H190" fill="none" stroke="#76ceeb" strokeWidth="1.5" strokeDasharray="18 120" opacity=".18" />
      </svg>
      <Image
        src="/brand/m3tm-approved-falcon.png"
        alt=""
        aria-hidden="true"
        unoptimized
        width={143}
        height={80}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      </span>

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
