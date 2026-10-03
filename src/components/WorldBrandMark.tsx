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
      className={`inline-flex items-center bg-transparent select-none ${hero ? 'gap-3' : 'gap-2'} ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className={`${hero ? 'w-16 h-16 md:w-[74px] md:h-[74px]' : 'w-10 h-10 md:w-11 md:h-11'} shrink-0 overflow-visible`}
      >
        <path
          d="M32 4 56 17v30L32 60 8 47V17L32 4Z"
          fill="rgba(7,9,14,0.58)"
          stroke="rgba(216,180,84,0.62)"
          strokeWidth="1.4"
        />
        <path
          d="M16 20 32 39 48 20v24M16 20v24M23 29l9 11 9-11"
          fill="none"
          stroke="#D8B454"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 16 32 6l20 10M12 48l20 10 20-10"
          fill="none"
          stroke="rgba(248,232,190,0.45)"
          strokeWidth="1"
        />
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(216,180,84,0.18)" />
      </svg>

      <div className="flex flex-col leading-none">
        <div
          className={`${hero ? 'text-[30px] md:text-[38px]' : 'text-[17px] md:text-[20px]'} whitespace-nowrap font-semibold tracking-[0.045em]`}
          style={{ textShadow: '0 1px 14px rgba(212,175,55,0.18)' }}
        >
          <span className="text-[#D8B454]">M3TM</span>
          <span className="text-[#F4F0E6]">.WORLD</span>
        </div>
        <div
          className={`${hero ? 'mt-1 text-[8px] md:text-[9px] tracking-[0.32em]' : 'mt-0.5 text-[6px] md:text-[7px] tracking-[0.24em]'} whitespace-nowrap font-mono uppercase text-[#D8B454]/55`}
        >
          PUBLIC INTELLIGENCE MAP
        </div>
      </div>
    </div>
  );
}
