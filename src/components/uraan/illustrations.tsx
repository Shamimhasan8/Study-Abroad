/**
 * Uraan illustration set — original, code-native vector art.
 * Shared visual language: deep green #163D36, leaf #317A62,
 * coral #E86F51, sunflower #E9B949 on warm paper.
 * All illustrations are decorative and aria-hidden; meaning is never
 * conveyed by artwork alone.
 */
import type { SVGProps } from "react";

type IllusProps = SVGProps<SVGSVGElement> & { width?: number; height?: number };

export function PaperPlaneMark({ width = 28, height = 28, ...props }: IllusProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={width}
      height={height}
      role="img"
      aria-label="Uraan paper plane logo"
      {...props}
    >
      <path d="M4 24 44 6 30 44l-9-15-17-5Z" fill="#317A62" />
      <path d="M4 24 44 6 21 29Z" fill="#E86F51" opacity="0.9" />
      <path d="m21 29 9 15 4-15Z" fill="#163D36" opacity="0.85" />
    </svg>
  );
}

/** The paper-plane flight moment after a meaningful action. */
export function PaperPlaneFlight({ width = 48, height = 48, className = "", ...props }: IllusProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={width}
      height={height}
      aria-hidden="true"
      focusable="false"
      className={`uraan-fly ${className}`}
      {...props}
    >
      <path d="M8 32 56 12 40 56l-9-14-23-10Z" fill="#317A62" />
      <path d="M8 32 56 12 31 37Z" fill="#E86F51" />
      <path d="m31 37 9 19 4-17Z" fill="#E9B949" />
    </svg>
  );
}

/** A curious student reading under a paper plane sky. */
export function StudentReading({ width = 220, height = 160, ...props }: IllusProps) {
  return (
    <svg viewBox="0 0 220 160" width={width} height={height} role="img" aria-label="A student reading a book with a paper plane flying above" {...props}>
      <circle cx="110" cy="70" r="52" fill="#F3E9D7" />
      <path d="M60 130c0-24 22-38 50-38s50 14 50 38" fill="#317A62" />
      <circle cx="110" cy="62" r="24" fill="#E9B949" />
      <path d="M96 54c2-12 26-12 28 0v10c0 10-6 18-14 18s-14-8-14-18Z" fill="#163D36" />
      <path d="M92 52c0-16 36-16 36 0l-4-2-6 4-8-4-8 4-6-4-4 2Z" fill="#163D36" />
      <path d="M84 106c6-8 16-12 26-12s20 4 26 12l-8 6c-5-5-11-8-18-8s-13 3-18 8Z" fill="#FFFDF8" />
      <path d="M84 106c8-4 18-4 26 0v8c-8-4-18-4-26 0Z" fill="#E86F51" />
      <path d="M136 106c-8-4-18-4-26 0v8c8-4 18-4 26 0Z" fill="#E9B949" />
      <path d="M168 24l20-7-8 17 5 2-22 10" fill="#317A62" />
      <path d="M168 24l20-7-13 12Z" fill="#E86F51" />
      <circle cx="34" cy="30" r="3" fill="#E9B949" />
      <circle cx="186" cy="58" r="4" fill="#E86F51" opacity="0.7" />
      <circle cx="26" cy="84" r="2.5" fill="#317A62" opacity="0.6" />
    </svg>
  );
}

/** Stacked books with a small plant — the preparation workspace. */
export function BookStack({ width = 140, height = 120, ...props }: IllusProps) {
  return (
    <svg viewBox="0 0 140 120" width={width} height={height} role="img" aria-label="A stack of books with a small plant growing on top" {...props}>
      <rect x="18" y="88" width="104" height="14" rx="3" fill="#317A62" />
      <rect x="24" y="72" width="92" height="14" rx="3" fill="#E9B949" />
      <rect x="18" y="56" width="104" height="14" rx="3" fill="#E86F51" opacity="0.85" />
      <rect x="24" y="40" width="92" height="14" rx="3" fill="#317A62" opacity="0.75" />
      <path d="M66 40V22" stroke="#163D36" strokeWidth="3" strokeLinecap="round" />
      <path d="M66 26c-8-2-12-8-10-14 8 0 12 6 10 14Zm0-2c8-4 10-10 6-16-7 2-9 8-6 16Z" fill="#317A62" />
      <circle cx="48" cy="30" r="2.5" fill="#E9B949" />
      <circle cx="96" cy="26" r="2" fill="#E86F51" opacity="0.8" />
    </svg>
  );
}

/** Milestone path — from home to a distant campus flag. */
export function MilestonePath({ width = 260, height = 110, ...props }: IllusProps) {
  return (
    <svg viewBox="0 0 260 110" width={width} height={height} role="img" aria-label="A dotted path from a house to a campus with milestone flags" {...props}>
      <path d="M24 84c40-26 84 14 116-10 20-15 44-18 68-12" stroke="#8FAE9F" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="84" r="8" fill="#317A62" />
      <path d="M24 76V48l16 6-16 6" fill="#E86F51" />
      <path d="M112 62l6 14h-12Z" fill="#E9B949" />
      <path d="M180 48l6 14h-12Z" fill="#317A62" />
      <rect x="212" y="30" width="6" height="40" rx="2" fill="#163D36" />
      <path d="M218 34h24l-7 8 7 8h-24Z" fill="#E86F51" />
      <circle cx="150" cy="20" r="3" fill="#E9B949" />
      <circle cx="70" cy="26" r="2.5" fill="#E86F51" opacity="0.7" />
    </svg>
  );
}

/** Small landscape — departure scene for the home hero. */
export function LandscapeScene({ width = 320, height = 140, ...props }: IllusProps) {
  return (
    <svg viewBox="0 0 320 140" width={width} height={height} role="img" aria-label="A calm landscape with hills, sun, and a flying paper plane" {...props}>
      <circle cx="252" cy="36" r="18" fill="#E9B949" opacity="0.9" />
      <path d="M0 118c40-30 80-18 120-34s80-6 120 10 80 6 80 6v40H0Z" fill="#8FAE9F" opacity="0.5" />
      <path d="M0 126c50-18 90-2 140-16s100 4 180 10v30H0Z" fill="#317A62" opacity="0.8" />
      <path d="M40 96l34-12-14 30 6 3-36 16" fill="#317A62" />
      <path d="M40 96l34-12-20 22Z" fill="#E86F51" />
      <path d="M84 22h22M95 14v8" stroke="#163D36" strokeWidth="3" strokeLinecap="round" />
      <circle cx="30" cy="28" r="3" fill="#E86F51" />
      <circle cx="150" cy="34" r="2.5" fill="#E9B949" />
      <circle cx="196" cy="20" r="3" fill="#317A62" opacity="0.6" />
    </svg>
  );
}

/** A small badge dot used for status indicators next to illustrations. */
export function StatusDot({ width = 12, height = 12, ...props }: IllusProps) {
  return (
    <svg viewBox="0 0 12 12" width={width} height={height} aria-hidden="true" focusable="false" {...props}>
      <circle cx="6" cy="6" r="5" fill="currentColor" />
    </svg>
  );
}
