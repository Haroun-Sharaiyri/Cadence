/**
 * src/components/goal/GoalHeroCard.test.tsx
 * Unit tests for GoalHeroCard component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { GoalHeroCard } from './GoalHeroCard';
import type { Goal, CountdownResult } from '../../domain/types';
import * as haptics from '../../utils/haptics';

const mockGoal: Goal = {
  id: 'goal-1',
  user_id: 'local',
  statement: 'Run a sub-4 hour marathon',
  target_date: '2026-12-31',
  updated_at: '2026-10-18T00:00:00.000Z',
  deleted_at: null,
};

const mockCountdown: CountdownResult = {
  daysRemaining: 74,
  status: 'future',
  displayText: '74 days left',
  hasTarget: true,
};

describe('GoalHeroCard Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders goal statement and countdown displayText', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <GoalHeroCard
          goal={mockGoal}
          countdown={mockCountdown}
          onOpenEditor={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('Run a sub-4 hour marathon');
    expect(container.textContent).toContain('74 days left');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders empty placeholder prompt when goal is null', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <GoalHeroCard
          goal={null}
          countdown={null}
          onOpenEditor={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('Tap to set your primary goal…');
    expect(container.textContent).not.toContain('days left');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('triggers onOpenEditor and light haptic on click', async () => {
    const hapticSpy = vi.spyOn(haptics, 'triggerHaptic').mockReturnValue(true);
    const onOpenEditor = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <GoalHeroCard
          goal={mockGoal}
          countdown={mockCountdown}
          onOpenEditor={onOpenEditor}
        />
      );
    });

    const button = container.querySelector('[role="button"]') as HTMLElement;
    expect(button).not.toBeNull();

    await act(async () => {
      button.click();
    });

    expect(onOpenEditor).toHaveBeenCalled();
    expect(hapticSpy).toHaveBeenCalledWith('light');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
