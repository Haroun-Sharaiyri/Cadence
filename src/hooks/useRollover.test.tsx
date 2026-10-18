/**
 * src/hooks/useRollover.test.tsx
 * Unit tests for useRollover hook using React 19 test harness.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useRollover, type UseRolloverResult } from './useRollover';
import { getLogicalDay } from '../domain/rollover';

describe('useRollover hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with current logical day and isRollingOver false', () => {
    let hookResult!: UseRolloverResult;

    function TestComponent() {
      hookResult = useRollover({ rolloverHour: 4 });
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    const expectedDay = getLogicalDay(new Date(), 4);
    expect(hookResult.currentLogicalDay).toBe(expectedDay);
    expect(hookResult.isRollingOver).toBe(false);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('triggers manual rollover and calls onRollover callback', async () => {
    const onRollover = vi.fn();
    let hookResult!: UseRolloverResult;

    function TestComponent() {
      hookResult = useRollover({ rolloverHour: 4, onRollover });
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    await act(async () => {
      await hookResult.triggerManualRollover();
    });

    expect(onRollover).toHaveBeenCalledTimes(1);
    expect(hookResult.isRollingOver).toBe(true);

    // Fast-forward cascade animation timer (800ms)
    act(() => {
      vi.advanceTimersByTime(850);
    });

    expect(hookResult.isRollingOver).toBe(false);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
