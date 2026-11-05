"use client";

/**
 * Uraan mentor mascot — an original round companion with a small paper-plane
 * crest, drawn in the Uraan warm palette (ink #173C35, green #286B58,
 * coral #D96D51, yellow #E7BF63, sage #E8EEE5). It is its own drawing, not
 * a copy of any illustration export. State differences are subtle: this is
 * a friendly presence, never a fake "thinking" indicator — the processing
 * state renders only while a real request is in flight.
 */
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

export type MentorMascotState =
  | "idle"
  | "processing"
  | "explaining"
  | "clarification"
  | "completion"
  | "unavailable";

const INK = "#173C35";
const GREEN = "#286B58";
const CORAL = "#D96D51";
const YELLOW = "#E7BF63";
const SAGE = "#E8EEE5";
const GRAY_BODY = "#E4E8E3";
const GRAY_LINE = "#8C9A92";

const ARIA_LABELS: Record<MentorMascotState, { en: string; bn: string }> = {
  idle: { en: "Uraan mentor companion, calm and smiling", bn: "উরান মেন্টর সঙ্গী, শান্ত ও হাসিমুখ" },
  processing: { en: "Uraan mentor companion, thinking", bn: "উরান মেন্টর সঙ্গী, ভাবছে" },
  explaining: { en: "Uraan mentor companion, explaining", bn: "উরান মেন্টর সঙ্গী, ব্যাখ্যা করছে" },
  clarification: { en: "Uraan mentor companion, asking a question", bn: "উরান মেন্টর সঙ্গী, প্রশ্ন করছে" },
  completion: { en: "Uraan mentor companion, celebrating progress", bn: "উরান মেন্টর সঙ্গী, অগ্রগতি উদযাপন করছে" },
  unavailable: { en: "Uraan mentor companion, resting offline", bn: "উরান মেন্টর সঙ্গী, অফলাইনে বিশ্রামে" },
};

export function MentorMascot({ state, size = 40 }: { state: MentorMascotState; size?: number }) {
  const { lang } = useI18n();
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animated = !reduceMotion && !prefersReduced;

  const offline = state === "unavailable";
  const bodyFill = offline ? GRAY_BODY : SAGE;
  const lineColor = offline ? GRAY_LINE : INK;
  const label = lang === "bn" ? ARIA_LABELS[state].bn : ARIA_LABELS[state].en;

  return (
    <motion.div
      key={state}
      initial={animated ? { opacity: 0, scale: 0.88 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label={label}
        focusable="false"
      >
        {/* crest: small paper plane (awake) / resting moon (offline) */}
        {offline ? (
          <path d="M40 13a8 8 0 1 0 6 12 9 9 0 0 1-6-12Z" fill={GRAY_LINE} />
        ) : (
          <>
            <path d="M22 16 46 5 36 22Z" fill={GREEN} />
            <path d="M22 16 46 5 30 13Z" fill={CORAL} opacity="0.9" />
          </>
        )}

        {/* round body */}
        <circle cx="32" cy="38" r="21" fill={bodyFill} stroke={lineColor} strokeWidth="2" />

        {/* warm cheeks */}
        <circle cx="21" cy="43" r="2.5" fill={CORAL} opacity={offline ? 0.25 : 0.45} />
        <circle cx="43" cy="43" r="2.5" fill={CORAL} opacity={offline ? 0.25 : 0.45} />

        {/* eyes: open (awake) / closed arcs (resting) */}
        {offline ? (
          <>
            <path d="M22 35q3 2.5 6 0" stroke={lineColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M36 35q3 2.5 6 0" stroke={lineColor} strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="25" cy="35" r="2.6" fill={lineColor} />
            <circle cx="39" cy="35" r="2.6" fill={lineColor} />
          </>
        )}

        {/* mouth / processing dots */}
        {state === "processing" ? (
          animated ? (
            [0, 1, 2].map((i) => (
              <motion.circle
                key={i}
                cx={26 + i * 6}
                cy={44}
                r="2.1"
                fill={lineColor}
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
              />
            ))
          ) : (
            [0, 1, 2].map((i) => (
              <circle key={i} cx={26 + i * 6} cy={44} r="2.1" fill={lineColor} opacity={0.3 + i * 0.25} />
            ))
          )
        ) : state === "explaining" ? (
          <ellipse cx="32" cy="44" rx="4.5" ry="3.2" fill={lineColor} opacity="0.85" />
        ) : state === "clarification" ? (
          <path d="M27 45h10" stroke={lineColor} strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : offline ? (
          <path d="M27 45q5 2 10 0" stroke={lineColor} strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M26 43q6 5 12 0" stroke={lineColor} strokeWidth="2" fill="none" strokeLinecap="round" />
        )}

        {/* speech sparkle while explaining */}
        {state === "explaining" && (
          <path d="M55 9l1.5 4.5L61 15l-4.5 1.5L55 21l-1.5-4.5L49 15l4.5-1.5Z" fill={YELLOW} />
        )}

        {/* question-mark brow while clarifying */}
        {state === "clarification" && (
          <>
            <path
              d="M36 21c0-3.5 5-3.5 5 0 0 2.2-2.5 2.4-2.5 4.6"
              stroke={CORAL}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="38.5" cy="29" r="1.3" fill={CORAL} />
          </>
        )}

        {/* green check halo on completion */}
        {state === "completion" && (
          <>
            <circle cx="32" cy="36" r="27.5" stroke={GREEN} strokeWidth="1.8" fill="none" strokeDasharray="3 7" opacity="0.65" />
            <path
              d="M48 7l3 3 5-6"
              stroke={GREEN}
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* quiet z z while offline */}
        {offline && (
          <>
            <path d="M49 27h5l-5 5h5" stroke={GRAY_LINE} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M56 19h4l-4 4h4" stroke={GRAY_LINE} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </motion.div>
  );
}
