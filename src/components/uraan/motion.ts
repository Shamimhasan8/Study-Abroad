/**
 * Uraan shared motion system (implementation prompt §7).
 *
 * One set of transition budgets and variants for every surface, so motion
 * feels like one product instead of unrelated animations:
 *
 *   controls     120–180ms   (hover, focus, press, small toggles)
 *   steps/drawers 180–300ms  (onboarding steps, sheets, reveals)
 *   data          250–450ms  (content swaps, journey transitions)
 *
 * Every helper accepts `reduce` (in-app setting OR prefers-reduced-motion);
 * when true the variants collapse to instant/short-fade equivalents —
 * features stay fully usable without animation.
 */
import type { Variants, Transition } from "framer-motion";

/** Canonical easing — gentle, editorial; never bouncy for content. */
export const EASE: Transition["ease"] = [0.25, 0.46, 0.45, 0.94];

/** Control feedback (hover/press): 150ms. */
export const DUR_CONTROL = 0.15;
/** Step / drawer / section reveal: 240ms. */
export const DUR_STEP = 0.24;
/** Data / content transitions: 360ms. */
export const DUR_DATA = 0.36;

/** Section entrance — rise + fade. Short-fade only when motion is reduced. */
export function sectionEntrance(reduce: boolean): Variants {
  return {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      ...(reduce ? {} : { y: 0 }),
      transition: { duration: reduce ? 0.12 : DUR_STEP, ease: EASE },
    },
  };
}

/** Staggered children entrance for card lists / step sequences. */
export function staggerList(reduce: boolean): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.04 },
    },
  };
}

/** Single list-item entrance (pairs with staggerList). */
export function listItem(reduce: boolean): Variants {
  return {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      ...(reduce ? {} : { y: 0 }),
      transition: { duration: reduce ? 0.1 : DUR_STEP, ease: EASE },
    },
  };
}

/** Content swap (tab panels, plan previews): gentle cross-fade + rise. */
export function contentSwap(reduce: boolean): Variants {
  return {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      ...(reduce ? {} : { y: 0 }),
      transition: { duration: reduce ? 0.12 : DUR_DATA, ease: EASE },
    },
    exit: { opacity: 0, transition: { duration: reduce ? 0.08 : DUR_CONTROL } },
  };
}

/** Direction-aware horizontal step transition (onboarding-style).
 * `dir` is +1 (forward) or -1 (back). Reduced motion → short fade. */
export function stepSlide(reduce: boolean, dir: 1 | -1): Variants {
  if (reduce) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.12 } },
      exit: { opacity: 0, transition: { duration: 0.08 } },
    };
  }
  return {
    hidden: { opacity: 0, x: 28 * dir },
    visible: { opacity: 1, x: 0, transition: { duration: DUR_STEP, ease: EASE } },
    exit: { opacity: 0, x: -28 * dir, transition: { duration: DUR_STEP, ease: EASE } },
  };
}
