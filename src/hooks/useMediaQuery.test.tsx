import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useMediaQuery, useIsDesktop } from './useMediaQuery';

describe('useMediaQuery & useIsDesktop', () => {
  it('evaluates desktop media query correctly', () => {
    let isDesktopValue: boolean | null = null;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    function TestComponent() {
      isDesktopValue = useIsDesktop();
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(isDesktopValue).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('evaluates custom media query with useMediaQuery', () => {
    let isDarkValue: boolean | null = null;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    function TestComponent() {
      isDarkValue = useMediaQuery('(prefers-color-scheme: dark)');
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(isDarkValue).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
