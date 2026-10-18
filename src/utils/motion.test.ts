import { describe, it, expect } from 'vitest';
import { SPRING_PRESETS, REDUCED_MOTION_TRANSITION, getMotionTransition } from './motion';

describe('Motion Physics & Fallback', () => {
  it('returns spring physics preset when reduced motion is disabled', () => {
    const transition = getMotionTransition('tabIndicator', false);
    expect(transition).toEqual(SPRING_PRESETS.tabIndicator);
    expect((transition as { type?: string }).type).toBe('spring');
  });

  it('returns reduced motion transition when reduced motion is enabled', () => {
    const transition = getMotionTransition('tabIndicator', true);
    expect(transition).toEqual(REDUCED_MOTION_TRANSITION);
    expect((transition as { duration?: number }).duration).toBe(0.15);
  });

  it('has tuned mass-spring-damper values for all presets', () => {
    for (const [key, preset] of Object.entries(SPRING_PRESETS)) {
      expect((preset as { type?: string }).type, `${key} should be spring`).toBe('spring');
      expect((preset as { stiffness?: number }).stiffness).toBeGreaterThan(100);
      expect((preset as { damping?: number }).damping).toBeGreaterThan(10);
    }
  });
});
