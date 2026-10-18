/**
 * src/components/checklist/ChecklistItemRow.test.tsx
 * Unit tests for ChecklistItemRow component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ChecklistItemRow } from './ChecklistItemRow';
import type { ChecklistItem } from '../../domain/types';
import * as haptics from '../../utils/haptics';

const mockItem: ChecklistItem = {
  id: 'test-item-1',
  user_id: 'local',
  list_type: 'today_morning',
  title: 'Drink 500ml water',
  sort_order: 1000,
  is_completed: false,
  completed_at: null,
  last_completed_day: null,
  created_at: '2026-10-18T00:00:00.000Z',
  updated_at: '2026-10-18T00:00:00.000Z',
  deleted_at: null,
};

describe('ChecklistItemRow Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders item title and unchecked checkbox', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ChecklistItemRow
          item={mockItem}
          isEditMode={false}
          onToggle={vi.fn()}
          onRename={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('Drink 500ml water');
    const checkbox = container.querySelector('button[role="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.getAttribute('aria-checked')).toBe('false');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('applies strikethrough and tertiary label style when completed', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const completedItem = { ...mockItem, is_completed: true };

    await act(async () => {
      root.render(
        <ChecklistItemRow
          item={completedItem}
          isEditMode={false}
          onToggle={vi.fn()}
          onRename={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    });

    const titleEl = container.querySelector('.line-through');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe('Drink 500ml water');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('reveals slide-out Delete button when minus button is clicked in Edit mode', async () => {
    const hapticSpy = vi.spyOn(haptics, 'triggerHaptic').mockReturnValue(true);
    const onDelete = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ChecklistItemRow
          item={mockItem}
          isEditMode={true}
          onToggle={vi.fn()}
          onRename={vi.fn()}
          onDelete={onDelete}
        />
      );
    });

    // In edit mode, leading minus button exists
    const minusBtn = container.querySelector('button[aria-label="Delete Drink 500ml water"]') as HTMLButtonElement;
    expect(minusBtn).not.toBeNull();

    // Reorder handle exists
    const reorderHandle = container.querySelector('[aria-label="Reorder Drink 500ml water"]');
    expect(reorderHandle).not.toBeNull();

    // Click minus button
    await act(async () => {
      minusBtn.click();
    });
    expect(hapticSpy).toHaveBeenCalledWith('medium');

    // Slide-out Delete button is now revealed
    const deleteBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete'
    );
    expect(deleteBtn).not.toBeNull();

    // Click delete confirmation
    await act(async () => {
      deleteBtn?.click();
    });
    expect(onDelete).toHaveBeenCalledWith('test-item-1');
    expect(hapticSpy).toHaveBeenCalledWith('heavy');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
