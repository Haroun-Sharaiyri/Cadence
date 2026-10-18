import { describe, it, expect } from 'vitest';
import { triggerHaptic } from './haptics';

describe('Haptics Utility', () => {
  it('safely handles environments without navigator.vibrate', () => {
    // In headless Node/Happy-DOM without native vibration
    const result = triggerHaptic('selection');
    expect(typeof result).toBe('boolean');
  });

  it('handles all haptic types without throwing exceptions', () => {
    const types = ['selection', 'light', 'medium', 'heavy', 'success', 'warning', 'error'] as const;
    for (const t of types) {
      expect(() => triggerHaptic(t)).not.toThrow();
    }
  });
});
