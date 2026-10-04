'use client';

type WorldBrandMarkProps = {
  variant?: 'hero' | 'header';
  className?: string;
};

export default function WorldBrandMark({ variant = 'header', className = '' }: WorldBrandMarkProps) {
  const hero = variant === 'hero';
  return (
    <div
      dir="ltr"
      aria-label="M3TM.WORLD"
      className={`inline-flex items-center bg-transparent select-none ${hero ? 'gap-3.5' : 'gap-2.5'} ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 72 72"
        className={`${hero ? 'w-[78px] h-[78px] md:w-[86px] md:h-[86px]' : 'w-[42px] h-[42px] md:w-[46px] md:h-[46px]'} shrink-0 overflow-visible`}
      >
        <defs>
          <linearGradient id="m3tm-gold" x1="8" y1="8" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F3D987" />
            <stop offset="0.48" stopColor="#D7AF4B" />
            <stop offset="1" stopColor="#8B6B24" />
          </linearGradient>
          <linearGradient id="m3tm-cyan" x1="18" y1="54" x2="57" y2="17" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5DE6F2" stopOpacity="0.18" />
            <stop offset="1" stopColor="#8AF4F6" stopOpacity="0.72" />
          </linearGradient>
        </defs>

        {/* Transparent emblem: compass frame + globe arcs + angular M monogram. */}
        <path
          d="M36 3.5 61.5 18.2v35.6L36 68.5 10.5 53.8V18.2L36 3.5Z"
          fill="rgba(4,8,13,0.30)"
          stroke="url(#m3tm-gold)"
          strokeWidth="1.55"
          strokeLinejoin="round"
        />
        <path
          d="M36 9.5 56.4 21.2v29.6L36 62.5 15.6 50.8V21.2L36 9.5Z"
          fill="none"
          stroke="rgba(244,227,174,0.18)"
          strokeWidth="0.9"
        />

        {/* World / orbit language — deliberately subtle so the mark stays legible at 42px. */}
        <ellipse cx="36" cy="36" rx="19.5" ry="8.8" fill="none" stroke="url(#m3tm-cyan)" strokeWidth="1" />
        <path d="M20.5 36h31M36 16.5c-6.2 5.4-8.8 12-8.8 19.5S29.8 50.1 36 55.5M36 16.5c6.2 5.4 8.8 12 8.8 19.5S42.2 50.1 36 55.5"
          fill="none" stroke="rgba(126,235,241,0.28)" strokeWidth="0.85" strokeLinecap="round" />

        {/* M3TM core monogram. */}
        <path
          d="M20.5 49V23.5L36 40.3l15.5-16.8V49"
          fill="none"
          stroke="url(#m3tm-gold)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m27.2 31.1 8.8 9.5 8.8-9.5"
          fill="none"
          stroke="#F3E2A8"
          strokeOpacity="0.68"
          strokeWidth="1.25"
          strokeLinecap="round"
        />

        {/* Live-data pulse / orientation detail. */}
        <circle cx="56.2" cy="20.2" r="2.15" fill="#67E8F9" />
        <circle cx="56.2" cy="20.2" r="4.1" fill="none" stroke="#67E8F9" strokeOpacity="0.18" />
        <path d="M36 2v5M36 65v5M7 36h5M60 36h5" stroke="#D7AF4B" strokeOpacity="0.48" strokeWidth="1" />
      </svg>

      <div className="flex min-w-0 flex-col justify-center leading-none">
        <div
          className={`${hero ? 'text-[34px] md:text-[42px]' : 'text-[18px] md:text-[21px]'} whitespace-nowrap font-bold tracking-[0.035em]`}
          style={{ textShadow: '0 1px 16px rgba(212,175,55,0.16)' }}
        >
          <span className="text-[#D9B650]">M3TM</span>
          <span className="text-[#F5F1E8]">.WORLD</span>
        </div>
        <div
          dir="rtl"
          className={`${hero ? 'mt-1.5 text-[9px] md:text-[10px]' : 'mt-1 text-[7px] md:text-[8px]'} whitespace-nowrap font-medium tracking-[0.055em] text-[#D8D2C4]/62`}
        >
          بيانات عالمية · مصادر منشورة · عرض حي
        </div>
      </div>
    </div>
  );
}
