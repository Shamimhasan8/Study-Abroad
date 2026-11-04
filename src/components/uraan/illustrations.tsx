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

/**
 * The composed hero scene: a student preparing at a desk, an unfolding
 * route map, and a paper plane flying toward a distant goal. Original
 * code-native vector art in the studio palette (Canvas #F8F6F0, Ink
 * #173C35, Green #286B58, Sage #E8EEE5, Coral #D96D51, Yellow #E7BF63).
 * Decorative only — aria-hidden; meaning never depends on artwork.
 */
export function HeroScene({ width = 560, height = 420, className = "", ...props }: IllusProps) {
  return (
    <svg
      viewBox="0 0 560 420"
      width={width}
      height={height}
      role="img"
      aria-label="A student preparing at a desk beside an unfolding route map, with a paper plane flying toward a goal"
      className={className}
      {...props}
    >
      {/* backdrop */}
      <rect x="0" y="0" width="560" height="420" rx="24" fill="#F1F2EC" />
      <circle cx="468" cy="84" r="46" fill="#E8EEE5" />
      <circle cx="468" cy="84" r="30" fill="#E7BF63" opacity="0.55" />

      {/* distant goal hill + flag */}
      <path d="M330 150c26-34 66-52 118-38 34 9 58 20 78 38v14H330Z" fill="#DCE5DB" />
      <path d="M526 112V70" stroke="#173C35" strokeWidth="4" strokeLinecap="round" />
      <path d="M526 70c16 4 28 10 34 18-10 6-22 8-34 6Z" fill="#D96D51" />

      {/* dashed flight path */}
      <path d="M86 236C160 210 236 176 300 140c26-14 52-24 84-28" fill="none" stroke="#286B58" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10" />

      {/* the paper plane */}
      <g transform="translate(320 118) rotate(-18)">
        <path d="M0 0 44 12 12 30Z" fill="#286B58" />
        <path d="M0 0 44 12 14 14Z" fill="#D96D51" opacity="0.92" />
        <path d="M14 14 12 30 22 18Z" fill="#173C35" opacity="0.8" />
      </g>

      {/* unfolding route map on the desk */}
      <g transform="translate(288 208) rotate(6)">
        <path d="M10 84C-6 52 2 18 38 6c30-10 74-4 104 10 26 12 34 44 20 66-16 24-58 34-96 26-24-5-42-12-56-24Z" fill="#FFFFFF" stroke="#E2E6DC" strokeWidth="2" />
        <path d="M22 72C12 48 20 24 48 16c24-7 60-2 84 9" fill="none" stroke="#286B58" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" />
        <circle cx="44" cy="66" r="7" fill="#E7BF63" />
        <circle cx="96" cy="28" r="7" fill="#D96D51" />
        <path d="M116 84l20 16" stroke="#E2E6DC" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* desk */}
      <rect x="24" y="300" width="286" height="16" rx="8" fill="#173C35" />
      <rect x="52" y="316" width="12" height="76" rx="6" fill="#286B58" />
      <rect x="270" y="316" width="12" height="76" rx="6" fill="#286B58" />

      {/* open book on desk */}
      <g transform="translate(56 258)">
        <path d="M4 42C24 30 52 30 72 42v0C52 54 24 54 4 42Z" fill="#FFFFFF" stroke="#E2E6DC" strokeWidth="2" />
        <path d="M76 42C96 30 124 30 144 42c-20 12-48 12-68 0Z" fill="#FFFFFF" stroke="#E2E6DC" strokeWidth="2" />
        <path d="M76 42v0" stroke="#E2E6DC" strokeWidth="2" />
        <path d="M14 40c14-8 32-8 46 0M86 40c14-8 32-8 46 0" stroke="#C9D3C6" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* steaming cup */}
      <g transform="translate(246 262)">
        <path d="M0 10h30v18a10 10 0 0 1-10 10h-10A10 10 0 0 1 0 28Z" fill="#FFFFFF" stroke="#E2E6DC" strokeWidth="2" />
        <path d="M30 14h8a8 8 0 0 1 0 16h-8" fill="none" stroke="#E2E6DC" strokeWidth="2" />
        <path d="M8 2c4-4-4-8 0-12M18 2c4-4-4-8 0-12" stroke="#C9D3C6" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>

      {/* the student */}
      <g transform="translate(116 148)">
        {/* chair back */}
        <rect x="6" y="84" width="14" height="120" rx="7" fill="#286B58" opacity="0.35" />
        {/* torso leaning slightly forward */}
        <path d="M18 210c-10-34-6-66 10-92 10-16 30-24 50-18 18 6 26 22 24 40-2 22-10 44-22 62-8 12-16 18-26 20Z" fill="#286B58" />
        {/* neck + head */}
        <rect x="56" y="86" width="18" height="26" rx="9" fill="#E8B48C" />
        <circle cx="70" cy="66" r="30" fill="#E8B48C" />
        {/* hair */}
        <path d="M40 62c-2-24 14-40 36-38 20 2 32 16 30 34-2 10-8 16-16 18 2-12-4-20-14-22-12-2-22 2-26 12-4-2-8-2-10-4Z" fill="#173C35" />
        {/* focused eye + smile */}
        <circle cx="82" cy="66" r="3.4" fill="#173C35" />
        <path d="M78 80c4 3 10 3 14 0" stroke="#173C35" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {/* arm reaching to the book */}
        <path d="M34 140c14 8 30 14 48 16 8 1 14 6 14 14 0 6-6 10-12 8-22-6-40-14-54-24Z" fill="#286B58" />
        <circle cx="96" cy="172" r="8" fill="#E8B48C" />
        {/* arm to laptop */}
        <path d="M30 168c10 12 22 22 36 28" stroke="#286B58" strokeWidth="18" strokeLinecap="round" fill="none" />
        <circle cx="70" cy="198" r="9" fill="#E8B48C" />
        {/* legs */}
        <path d="M40 250c2 18 0 36-6 52h16c8-18 12-38 10-56Z" fill="#173C35" />
        <path d="M66 250c6 16 6 36 2 52h16c4-18 4-38-2-54Z" fill="#173C35" />
      </g>

      {/* laptop on desk */}
      <g transform="translate(180 268) rotate(-4)">
        <rect x="0" y="0" width="76" height="48" rx="6" fill="#173C35" />
        <rect x="5" y="5" width="66" height="38" rx="4" fill="#E8EEE5" />
        <path d="M14 34c10-14 22-20 34-18" stroke="#286B58" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M14 24h24" stroke="#D96D51" strokeWidth="3" strokeLinecap="round" />
        <rect x="-8" y="46" width="92" height="8" rx="4" fill="#286B58" />
      </g>

      {/* milestone dots along the bottom */}
      <g>
        <circle cx="40" cy="392" r="6" fill="#286B58" />
        <circle cx="120" cy="392" r="6" fill="#286B58" opacity="0.7" />
        <circle cx="200" cy="392" r="6" fill="#E7BF63" />
        <circle cx="280" cy="392" r="6" fill="#286B58" opacity="0.7" />
        <circle cx="360" cy="392" r="6" fill="#286B58" />
        <path d="M46 392h68M126 392h68M206 392h68M286 392h68" stroke="#E2E6DC" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
