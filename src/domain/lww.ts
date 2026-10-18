/**
 * src/domain/lww.ts
 * Monotonic Lamport Clock and Deterministic Last-Write-Wins (LWW) conflict resolution algorithm.
 */

export class LamportClock {
  private lastEffectiveMs: number = 0;

  constructor(initialMs: number = 0) {
    this.lastEffectiveMs = initialMs;
  }

  /**
   * Generates a strictly monotonically increasing ISO 8601 UTC timestamp.
   * If called multiple times within the same millisecond or if wall-clock ticks slowly,
   * increments beyond the previous effective timestamp to guarantee strict ordering.
   */
  public now(): string {
    const realNow = Date.now();
    this.lastEffectiveMs = Math.max(realNow, this.lastEffectiveMs + 1);
    return new Date(this.lastEffectiveMs).toISOString();
  }

  /**
   * Advances the internal clock if a received remote timestamp is ahead of the local counter.
   */
  public receive(remoteIsoString: string): void {
    const remoteMs = new Date(remoteIsoString).getTime();
    if (!isNaN(remoteMs) && remoteMs >= this.lastEffectiveMs) {
      this.lastEffectiveMs = remoteMs;
    }
  }

  public getRawTime(): number {
    return this.lastEffectiveMs;
  }
}

export const lamportClock = new LamportClock();

export interface LwwEntity {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface LwwResolution<T extends LwwEntity> {
  winner: 'local' | 'remote' | 'equal';
  winningRecord: T;
  reason: 'timestamp' | 'tie_breaker' | 'identical';
}

/**
 * Deterministically resolves a conflict between a local record and a remote record.
 * Uses updated_at timestamp as primary order and client/record tie-breaker string as secondary order.
 */
export function resolveLWW<T extends LwwEntity>(
  local: T,
  remote: T,
  localTieBreaker?: string,
  remoteTieBreaker?: string
): LwwResolution<T> {
  if (local.id !== remote.id) {
    throw new Error(`Cannot resolve LWW conflict between different IDs: ${local.id} vs ${remote.id}`);
  }

  const localTime = new Date(local.updated_at).getTime();
  const remoteTime = new Date(remote.updated_at).getTime();

  // 1. Primary order: Numerical timestamp comparison
  if (remoteTime > localTime) {
    return { winner: 'remote', winningRecord: remote, reason: 'timestamp' };
  }
  if (localTime > remoteTime) {
    return { winner: 'local', winningRecord: local, reason: 'timestamp' };
  }

  // 2. Secondary order: String ISO comparison (sub-millisecond or lexicographic difference)
  const timeComparison = remote.updated_at.localeCompare(local.updated_at);
  if (timeComparison > 0) {
    return { winner: 'remote', winningRecord: remote, reason: 'timestamp' };
  }
  if (timeComparison < 0) {
    return { winner: 'local', winningRecord: local, reason: 'timestamp' };
  }

  // 3. Exact timestamp match: Check content identity
  if (JSON.stringify(local) === JSON.stringify(remote)) {
    return { winner: 'equal', winningRecord: local, reason: 'identical' };
  }

  // 4. Deterministic tie-breaker using client UUID or record content hash
  const tieL = localTieBreaker ?? JSON.stringify(local);
  const tieR = remoteTieBreaker ?? JSON.stringify(remote);

  const tieComparison = tieR.localeCompare(tieL);
  if (tieComparison > 0) {
    return { winner: 'remote', winningRecord: remote, reason: 'tie_breaker' };
  } else if (tieComparison < 0) {
    return { winner: 'local', winningRecord: local, reason: 'tie_breaker' };
  }

  // Tertiary tie-breaker: Content hash comparison when tie-breaker strings are identical
  const contentComparison = JSON.stringify(remote).localeCompare(JSON.stringify(local));
  if (contentComparison > 0) {
    return { winner: 'remote', winningRecord: remote, reason: 'tie_breaker' };
  } else {
    return { winner: 'local', winningRecord: local, reason: 'tie_breaker' };
  }
}
