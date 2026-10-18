/**
 * Formats a Date object for the collapsing header date subtitle.
 * Example: "Saturday, October 17"
 */
export function formatHeaderDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Formats a full date for desktop layout header.
 * Example: "Saturday, October 17, 2026"
 */
export function formatDesktopDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Returns an ISO timestamp string.
 */
export function getMonotonicTimestamp(): string {
  return new Date().toISOString();
}
