/**
 * src/components/checklist/ProgressRing.test.tsx
 * Unit tests for ProgressRing SVG geometry, calculations, accessibility, and haptics.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProgressRing } from './ProgressRing';
import * as haptics from '../../utils/haptics';

describe('ProgressRing Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders SVG with correct geometry and aria progressbar attributes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ProgressRing completed={2} total={4} size={32} strokeWidth={4} />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('2');
    expect(progressbar?.getAttribute('aria-valuemax')).toBe('4');
    expect(progressbar?.getAttribute('aria-label')).toContain('2 of 4 items completed (50%)');

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');

    // Radius = (32 - 4) / 2 = 14
    // Circumference = 2 * PI * 14 = 87.96459430051421
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2); // Background track and animated stroke
    expect(circles[0]?.getAttribute('r')).toBe('14');
    expect(circles[1]?.getAttribute('r')).toBe('14');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('handles empty section (total = 0) without NaN or division by zero', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ProgressRing completed={0} total={0} />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('0');
    expect(progressbar?.getAttribute('aria-valuemax')).toBe('0');
    expect(progressbar?.getAttribute('aria-label')).toBe('No items in section');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('clamps over-completion ratio cleanly to 100%', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ProgressRing completed={5} total={4} />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute('aria-label')).toContain('100%');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('fires haptic success and onComplete callback upon transition to 100%', async () => {
    const hapticSpy = vi.spyOn(haptics, 'triggerHaptic').mockReturnValue(true);
    const onComplete = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // Initial state: 1 of 2
    await act(async () => {
      root.render(<ProgressRing completed={1} total={2} onComplete={onComplete} />);
    });
    expect(hapticSpy).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    // Transition state: 2 of 2 (100% completed)
    await act(async () => {
      root.render(<ProgressRing completed={2} total={2} onComplete={onComplete} />);
    });
    expect(hapticSpy).toHaveBeenCalledWith('success');
    expect(onComplete).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
