/**
 * src/components/auth/OtpInput.test.tsx
 * Unit tests for discrete 6-digit OTP input.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { OtpInput } from './OtpInput';

describe('OtpInput Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders 6 discrete input boxes with correct attributes and minimum 44px tap targets', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<OtpInput value="" onChange={vi.fn()} />);
    });

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBe(6);

    inputs.forEach((input, idx) => {
      expect(input.getAttribute('type')).toBe('text');
      expect(input.getAttribute('inputmode')).toBe('numeric');
      expect(input.getAttribute('pattern')).toBe('[0-9]*');
      expect(input.getAttribute('maxlength')).toBe('1');
      expect(input.getAttribute('aria-label')).toBe(`Digit ${idx + 1} of 6`);
      // Verify min 44px tap target styling classes
      expect(input.className).toContain('min-w-[44px]');
      expect(input.className).toContain('min-h-[44px]');
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('handles paste of 6 digits and triggers onComplete', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onChange = vi.fn();
    const onComplete = vi.fn();

    await act(async () => {
      root.render(<OtpInput value="" onChange={onChange} onComplete={onComplete} />);
    });

    const firstInput = container.querySelector('input');
    expect(firstInput).not.toBeNull();

    await act(async () => {
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: () => '948201',
        },
      });
      firstInput!.dispatchEvent(pasteEvent);
    });

    expect(onChange).toHaveBeenCalledWith('948201');
    expect(onComplete).toHaveBeenCalledWith('948201');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('cleans non-numeric formatting from pasted text (e.g. 123-456)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onChange = vi.fn();
    const onComplete = vi.fn();

    await act(async () => {
      root.render(<OtpInput value="" onChange={onChange} onComplete={onComplete} />);
    });

    const firstInput = container.querySelector('input');
    await act(async () => {
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: () => 'Code: 582-914',
        },
      });
      firstInput!.dispatchEvent(pasteEvent);
    });

    expect(onChange).toHaveBeenCalledWith('582914');
    expect(onComplete).toHaveBeenCalledWith('582914');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('auto-advances focus on digit change and handles backspace navigation', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let currentValue = '';
    const onChange = vi.fn((val: string) => {
      currentValue = val;
    });

    await act(async () => {
      root.render(<OtpInput value={currentValue} onChange={onChange} />);
    });

    const inputs = container.querySelectorAll('input');
    const firstInput = inputs[0]!;

    // Type a single digit in box 0
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(firstInput, '7');
      firstInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('7');

    // Test backspace navigation on second input when empty
    await act(async () => {
      root.render(<OtpInput value="7" onChange={onChange} />);
    });

    const secondInput = inputs[1]!;
    await act(async () => {
      const backspaceEvent = new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      });
      secondInput.dispatchEvent(backspaceEvent);
    });

    // Should clear previous digit '7' -> ''
    expect(onChange).toHaveBeenCalledWith('');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
