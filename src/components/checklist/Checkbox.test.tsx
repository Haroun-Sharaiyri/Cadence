/**
 * src/components/checklist/Checkbox.test.tsx
 * Unit tests for Reminders-style circular Checkbox component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Checkbox } from './Checkbox';
import * as haptics from '../../utils/haptics';

describe('Checkbox Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with role="checkbox" and aria-checked matching checked prop', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Checkbox checked={false} onChange={vi.fn()} label="Test Habit" />);
    });

    const button = container.querySelector('button[role="checkbox"]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-checked')).toBe('false');
    expect(button?.getAttribute('aria-label')).toBe('Mark "Test Habit" as complete');

    await act(async () => {
      root.render(<Checkbox checked={true} onChange={vi.fn()} label="Test Habit" />);
    });
    expect(button?.getAttribute('aria-checked')).toBe('true');
    expect(button?.getAttribute('aria-label')).toBe('Mark "Test Habit" as incomplete');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('calls onChange and triggers haptic feedback on click', async () => {
    const hapticSpy = vi.spyOn(haptics, 'triggerHaptic').mockReturnValue(true);
    const onChange = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Checkbox checked={false} onChange={onChange} />);
    });

    const button = container.querySelector('button[role="checkbox"]') as HTMLButtonElement;
    expect(button).not.toBeNull();

    await act(async () => {
      button.click();
    });

    expect(onChange).toHaveBeenCalledWith(true);
    expect(hapticSpy).toHaveBeenCalledWith('light');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('does not call onChange when disabled', async () => {
    const hapticSpy = vi.spyOn(haptics, 'triggerHaptic').mockReturnValue(true);
    const onChange = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Checkbox checked={false} disabled={true} onChange={onChange} />);
    });

    const button = container.querySelector('button[role="checkbox"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await act(async () => {
      button.click();
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(hapticSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('toggles on Space key press', async () => {
    const onChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Checkbox checked={false} onChange={onChange} />);
    });

    const button = container.querySelector('button[role="checkbox"]') as HTMLButtonElement;
    await act(async () => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
