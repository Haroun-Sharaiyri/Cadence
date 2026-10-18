export type HapticType =
  | 'selection'  // Micro-tick for tab switch, segmented control (8ms)
  | 'light'      // Checkbox toggle, light button tap (12ms)
  | 'medium'     // Edit mode toggle, reorder grab (22ms)
  | 'heavy'      // Deletion confirmation, swipe trigger (35ms)
  | 'success'    // Routine section or day completed ([12, 40, 18]ms)
  | 'warning'    // Destructive alert confirmation ([25, 50, 25]ms)
  | 'error';     // Authentication error, invalid OTP ([30, 60, 30, 60, 40]ms)

/**
 * Triggers safe WebKit / browser haptic vibration cues.
 * Wrapped in try/catch to guarantee zero exceptions.
 */
export function triggerHaptic(type: HapticType): boolean {
  if (typeof window === 'undefined' || !('navigator' in window)) {
    return false;
  }

  if (typeof navigator.vibrate !== 'function') {
    return false;
  }

  try {
    switch (type) {
      case 'selection':
        return navigator.vibrate(8);
      case 'light':
        return navigator.vibrate(12);
      case 'medium':
        return navigator.vibrate(22);
      case 'heavy':
        return navigator.vibrate(35);
      case 'success':
        return navigator.vibrate([12, 40, 18]);
      case 'warning':
        return navigator.vibrate([25, 50, 25]);
      case 'error':
        return navigator.vibrate([30, 60, 30, 60, 40]);
      default:
        return false;
    }
  } catch {
    // Graceful silent degradation
    return false;
  }
}
