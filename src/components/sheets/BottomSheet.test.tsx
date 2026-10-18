/**
 * src/components/sheets/BottomSheet.test.tsx
 * Unit tests for BottomSheet modal component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BottomSheet } from './BottomSheet';

describe('BottomSheet Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal dialog when isOpen is true and locks body scroll', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BottomSheet isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Sheet Content</p>
        </BottomSheet>
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(container.textContent).toContain('Test Modal');
    expect(container.textContent).toContain('Sheet Content');
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('does not render when isOpen is false', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BottomSheet isOpen={false} onClose={vi.fn()} title="Closed Modal">
          <p>Hidden Content</p>
        </BottomSheet>
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BottomSheet isOpen={true} onClose={onClose} title="Escape Modal">
          <p>Press Escape</p>
        </BottomSheet>
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
