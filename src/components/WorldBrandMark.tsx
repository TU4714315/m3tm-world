"use client";

import BrandMark from './brand/BrandMark';

type WorldBrandMarkProps = {
  variant?: 'hero' | 'header';
  className?: string;
};

export default function WorldBrandMark({ variant = 'header', className = '' }: WorldBrandMarkProps) {
  return <BrandMark product="WORLD" tone="public" animated={false} aria-label="M3TM.WORLD"
    className={`world-brand-${variant} ${className}`}
    imageClassName={variant === 'hero' ? '!w-[86px] !h-[64px]' : '!w-[54px] !h-[40px]'} />;
}
