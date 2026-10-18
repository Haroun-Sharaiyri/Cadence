import { useState, useEffect } from 'react';

/**
 * React hook that listens to a CSS media query and updates state when it matches.
 * Initialized synchronously on client to prevent initial layout shift.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    const updateMatch = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQueryList.matches);

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', updateMatch);
      return () => mediaQueryList.removeEventListener('change', updateMatch);
    } else {
      // Legacy WebKit fallback
      mediaQueryList.addListener(updateMatch);
      return () => mediaQueryList.removeListener(updateMatch);
    }
  }, [query]);

  return matches;
}

/**
 * Returns true if viewport is >= 1024px (Desktop), false otherwise (Mobile).
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
