"use client";

import { useId } from "react";
import "@/styles/brand-apex.css";
import "@/styles/brand-motion.css";

export type BrandTone = "public" | "internal" | "operations" | "cyan" | "gold" | "red";
export type BrandVariant = "full" | "mark";
export type BrandState = "normal" | "scanning" | "alert";
export type BrandForm = "orbit" | "prism" | "relay";

type BrandMarkProps = {
  product?: "APP" | "WORLD";
  className?: string;
  imageClassName?: string;
  compact?: boolean;
  subtitle?: string;
  /** Selects a compatible surface tone; APEX keeps cyan observation and gold decision paths. */
  tone?: BrandTone;
  /** `mark` is useful for navigation icons and favicon-sized surfaces. */
  variant?: BrandVariant;
  /** Operational state: static decision, active scan, or semantic alert. */
  state?: BrandState;
  /** A preview-selectable geometric signature; never a letterform. */
  form?: BrandForm;
  /** Disables motion while keeping state and signal colour legible. */
  animated?: boolean;
  "aria-label"?: string;
};

/**
 * M3TM APEX is a non-literal decision signature. Its form can be reviewed as
 * an orbit, prism, or relay while cyan observation enters from the left and a
 * decision path leaves to the right. SVG ids remain instance-specific.
 */
export default function BrandMark({
  product = "APP",
  className,
  imageClassName,
  compact = false,
  subtitle,
  tone,
  variant = "full",
  state = "normal",
  form = "orbit",
  animated = true,
  "aria-label": ariaLabel,
}: BrandMarkProps) {
  const id = useId().replace(/:/g, "");
  const markOnly = compact || variant === "mark";
  const shellId = `${id}-shell`;
  const depthId = `${id}-depth`;
  const cyanId = `${id}-cyan`;
  const goldId = `${id}-gold`;
  const glowId = `${id}-glow`;
  const geometry = getMarkGeometry(form);

  return (
    <div
      className={["m3tm-brand-mark inline-flex items-center gap-3", className].filter(Boolean).join(" ")}
      data-tone={tone ?? "auto"}
      data-state={state}
      data-form={form}
      data-animated={animated ? "true" : "false"}
      data-variant={markOnly ? "mark" : "full"}
      dir="ltr"
      aria-label={ariaLabel}
    >
      <span
        className={["m3tm-brand-mark__frame relative flex shrink-0 items-center justify-center", imageClassName].filter(Boolean).join(" ")}
        aria-hidden={markOnly ? undefined : true}
        role={markOnly ? "img" : undefined}
        aria-label={markOnly ? "M3TM APEX" : undefined}
      >
        <span className="m3tm-brand-mark__halo absolute" aria-hidden="true" />
        <svg
          className="m3tm-brand-mark__svg relative overflow-visible"
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
              <stop className="m3tm-brand-mark__stop-a" offset="0" stopOpacity="0.1" />
              <stop className="m3tm-brand-mark__stop-a" offset="1" stopOpacity="0.72" />
            </linearGradient>
            <linearGradient id={goldId} x1="1" y1="0" x2="0" y2="0">
              <stop className="m3tm-brand-mark__stop-b" offset="0" stopOpacity="0.12" />
              <stop className="m3tm-brand-mark__stop-b" offset="1" stopOpacity="0.76" />
            </linearGradient>
            <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.45" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path className="m3tm-brand-mark__field-l" d="M14 34 H46 L70 46 V68 L46 80 H14 Z" fill={`url(#${cyanId})`} />
          <path className="m3tm-brand-mark__field-r" d="M186 34 H154 L130 46 V68 L154 80 H186 Z" fill={`url(#${goldId})`} />

          <g className="m3tm-brand-mark__trace-l" fill="none" strokeWidth="1.7" strokeLinecap="round">
            <path d="M12 30 H38 L58 42" />
            <path d="M12 59 H50 L68 57" />
            <path d="M12 88 H38 L58 72" />
            <circle cx="22" cy="30" r="2.2" />
            <circle cx="30" cy="88" r="2.2" />
          </g>
          <g className="m3tm-brand-mark__trace-r" fill="none" strokeWidth="1.7" strokeLinecap="round">
            <path d="M142 42 L162 30 H188" />
            <path d="M132 57 H150 H188" />
            <path d="M142 72 L162 88 H188" />
            <circle cx="178" cy="30" r="2.2" />
            <circle cx="170" cy="88" r="2.2" />
          </g>

          <path className="m3tm-brand-mark__core-depth" d={geometry.depthPath} fill={`url(#${depthId})`} />
          <path className="m3tm-brand-mark__core-shell" d={geometry.shellPath} fill={`url(#${shellId})`} />
          <path className="m3tm-brand-mark__core-channel" d={geometry.channelPath} />
          <path className="m3tm-brand-mark__core" d={geometry.corePath} filter={`url(#${glowId})`} />

          <path className="m3tm-brand-mark__runner-l" d="M12 59 H50 L70 57" fill="none" strokeWidth="2.8" strokeLinecap="round" filter={`url(#${glowId})`} />
          <path className="m3tm-brand-mark__runner-r" d="M130 57 H150 H188" fill="none" strokeWidth="2.8" strokeLinecap="round" filter={`url(#${glowId})`} />
          <path className="m3tm-brand-mark__emergency" d={geometry.shellPath} fill="none" strokeWidth="3.2" strokeLinejoin="round" filter={`url(#${glowId})`} />
          <path className="m3tm-brand-mark__scan" d="M10 108 H190" fill="none" strokeWidth="1.5" strokeLinecap="round" pathLength="100" />
        </svg>
      </span>

      {!markOnly ? (
        <span className="min-w-0 text-left">
          <span className="block whitespace-nowrap font-mono text-lg font-black tracking-[0.08em] text-ir-text">
            M3TM.<span className="m3tm-brand-mark__wordmark">{product}</span>
          </span>
          {subtitle ? <span dir="auto" className="mt-1 block whitespace-nowrap font-mono text-[11px] tracking-[0.1em] text-ir-muted/95">{subtitle}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

function getMarkGeometry(form: BrandForm) {
  if (form === "prism") {
    return {
      depthPath: "M102 17 L142 57 L102 99 L60 57 Z",
      shellPath: "M100 14 L139 57 L100 100 L61 57 Z",
      channelPath: "M100 27 L127 57 L100 87 L73 57 Z",
      corePath: "M100 42 L115 57 L100 72 L85 57 Z",
    };
  }

  if (form === "relay") {
    return {
      depthPath: "M100 17 A40 40 0 1 1 99.9 17 Z",
      shellPath: "M100 15 A38 38 0 1 1 99.9 15 Z",
      channelPath: "M100 28 A25 25 0 1 1 99.9 28 Z",
      corePath: "M100 43 A14 14 0 1 1 99.9 43 Z",
    };
  }

  return {
    depthPath: "M102 21 L136 41 L136 73 L102 95 L66 73 L66 41 Z",
    shellPath: "M100 18 L134 38 L134 76 L100 98 L66 76 L66 38 Z",
    channelPath: "M100 30 L122 43 L122 71 L100 85 L78 71 L78 43 Z",
    corePath: "M100 42 L115 57 L100 72 L85 57 Z",
  };
}
