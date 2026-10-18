import { describe, it, expect } from 'vitest';
import { formatHeaderDate, formatDesktopDate, getMonotonicTimestamp } from './time';

describe('Time Utils', () => {
  it('formats header date without year', () => {
    const fixedDate = new Date('2026-10-17T12:00:00Z');
    const formatted = formatHeaderDate(fixedDate);
    expect(formatted).toContain('October');
    expect(formatted).toContain('17');
  });

  it('formats desktop date with year', () => {
    const fixedDate = new Date('2026-10-17T12:00:00Z');
    const formatted = formatDesktopDate(fixedDate);
    expect(formatted).toContain('October');
    expect(formatted).toContain('17');
    expect(formatted).toContain('2026');
  });

  it('generates a valid ISO timestamp', () => {
    const ts = getMonotonicTimestamp();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
