import { type Transition } from 'framer-motion';

export const SPRING_PRESETS = {
  /** Tab bar active pill sliding transition */
  tabIndicator: {
    type: 'spring',
    stiffness: 500,
    damping: 28,
    mass: 0.8,
  } as Transition,

  /** Bottom sheet modal presentation */
  sheet: {
    type: 'spring',
    stiffness: 340,
    damping: 32,
    mass: 0.9,
  } as Transition,

  /** Bottom sheet modal dismissal */
  sheetDismiss: {
    type: 'spring',
    stiffness: 380,
    damping: 35,
    mass: 0.8,
  } as Transition,

  /** Checkbox scale micro-interaction */
  checkboxSnap: {
    type: 'spring',
    stiffness: 500,
    damping: 24,
    mass: 0.6,
  } as Transition,

  /** List item reordering and layout reflow */
  listReflow: {
    type: 'spring',
    stiffness: 320,
    damping: 30,
    mass: 0.8,
  } as Transition,

  /** Progress ring fill animation */
  progressRing: {
    type: 'spring',
    stiffness: 220,
    damping: 26,
    mass: 0.7,
  } as Transition,

  /** Background scale-back during modal presentation */
  backgroundScale: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    mass: 0.9,
  } as Transition,
} as const;

/** Fallback transition for prefers-reduced-motion */
export const REDUCED_MOTION_TRANSITION: Transition = {
  duration: 0.15,
  ease: 'easeInOut',
};

/**
 * Returns either the requested spring preset or the reduced-motion crossfade
 * based on the user's accessibility preference.
 */
export function getMotionTransition(
  preset: keyof typeof SPRING_PRESETS,
  shouldReduceMotion: boolean | null
): Transition {
  if (shouldReduceMotion) {
    return REDUCED_MOTION_TRANSITION;
  }
  return SPRING_PRESETS[preset];
}
