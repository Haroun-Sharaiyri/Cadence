/**
 * src/domain/lww.test.ts
 * Proves mathematical convergence, commutativity, associativity, and tombstone precedence for LWW conflict resolution.
 */

import { describe, it, expect } from 'vitest';
import { LamportClock, resolveLWW, type LwwEntity } from './lww';

interface MockItem extends LwwEntity {
  title: string;
  is_completed: boolean;
}

describe('Monotonic Lamport Clock', () => {
  it('guarantees strictly increasing timestamps even across 1,000 rapid calls', () => {
    const clock = new LamportClock();
    const timestamps: string[] = [];

    for (let i = 0; i < 1000; i++) {
      timestamps.push(clock.now());
    }

    for (let i = 1; i < timestamps.length; i++) {
      const prev = timestamps[i - 1];
      const curr = timestamps[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      const prevMs = new Date(prev!).getTime();
      const currMs = new Date(curr!).getTime();
      expect(currMs).toBeGreaterThan(prevMs);
    }
  });

  it('advances internal clock when receiving a future remote timestamp', () => {
    const clock = new LamportClock(10000);
    const remoteFuture = '2030-01-01T00:00:00.000Z';

    clock.receive(remoteFuture);
    const nextLocal = clock.now();

    expect(new Date(nextLocal).getTime()).toBeGreaterThan(new Date(remoteFuture).getTime());
  });
});

describe('Deterministic LWW Conflict Resolution', () => {
  it('selects the record with the newer timestamp as the winner', () => {
    const local: MockItem = {
      id: 'item-1',
      title: 'Local Title',
      is_completed: false,
      updated_at: '2026-10-18T10:00:00.000Z',
    };
    const remote: MockItem = {
      id: 'item-1',
      title: 'Remote Title',
      is_completed: true,
      updated_at: '2026-10-18T10:05:00.000Z',
    };

    const res = resolveLWW(local, remote);
    expect(res.winner).toBe('remote');
    expect(res.winningRecord.title).toBe('Remote Title');
  });

  it('selects local record if local timestamp is newer', () => {
    const local: MockItem = {
      id: 'item-1',
      title: 'Local Title Newer',
      is_completed: true,
      updated_at: '2026-10-18T10:10:00.000Z',
    };
    const remote: MockItem = {
      id: 'item-1',
      title: 'Remote Title Older',
      is_completed: false,
      updated_at: '2026-10-18T10:05:00.000Z',
    };

    const res = resolveLWW(local, remote);
    expect(res.winner).toBe('local');
    expect(res.winningRecord.title).toBe('Local Title Newer');
  });

  it('uses tie-breaker UUID deterministically when timestamps match exactly', () => {
    const timestamp = '2026-10-18T10:00:00.000Z';
    const local: MockItem = {
      id: 'item-1',
      title: 'Client A Edit',
      is_completed: false,
      updated_at: timestamp,
    };
    const remote: MockItem = {
      id: 'item-1',
      title: 'Client B Edit',
      is_completed: true,
      updated_at: timestamp,
    };

    const clientAUuid = 'aaaa-1111';
    const clientBUuid = 'bbbb-2222';

    // bbbb-2222 > aaaa-1111 lexicographically -> remote wins
    const resA = resolveLWW(local, remote, clientAUuid, clientBUuid);
    expect(resA.winner).toBe('remote');
    expect(resA.winningRecord.title).toBe('Client B Edit');

    // On Client B, local is clientBUuid and remote is clientAUuid -> local wins
    const resB = resolveLWW(remote, local, clientBUuid, clientAUuid);
    expect(resB.winner).toBe('local');
    expect(resB.winningRecord.title).toBe('Client B Edit');

    // Both clients converge on identical content!
    expect(resA.winningRecord.title).toBe(resB.winningRecord.title);
  });

  it('proves commutativity: resolveLWW(A, B) and resolveLWW(B, A) converge on the same record', () => {
    const itemA: MockItem = {
      id: 'item-1',
      title: 'Item A',
      is_completed: false,
      updated_at: '2026-10-18T12:00:00.000Z',
    };
    const itemB: MockItem = {
      id: 'item-1',
      title: 'Item B',
      is_completed: true,
      updated_at: '2026-10-18T12:01:00.000Z',
    };

    const res1 = resolveLWW(itemA, itemB, 'client-a', 'client-b');
    const res2 = resolveLWW(itemB, itemA, 'client-b', 'client-a');

    expect(res1.winningRecord).toEqual(res2.winningRecord);
  });

  it('guarantees commutativity when tie-breaker strings are identical via content hash', () => {
    const timestamp = '2026-10-18T10:00:00.000Z';
    const itemA: MockItem = {
      id: 'item-1',
      title: 'Item A',
      is_completed: false,
      updated_at: timestamp,
    };
    const itemB: MockItem = {
      id: 'item-1',
      title: 'Item B',
      is_completed: true,
      updated_at: timestamp,
    };

    const identicalTie = 'same-user-id';
    const resAB = resolveLWW(itemA, itemB, identicalTie, identicalTie);
    const resBA = resolveLWW(itemB, itemA, identicalTie, identicalTie);

    expect(resAB.winningRecord).toEqual(resBA.winningRecord);
  });

  it('proves associativity across 3 concurrent offline edits', () => {
    const itemA: MockItem = {
      id: 'item-1',
      title: 'Edit 1',
      is_completed: false,
      updated_at: '2026-10-18T12:00:00.000Z',
    };
    const itemB: MockItem = {
      id: 'item-1',
      title: 'Edit 2',
      is_completed: true,
      updated_at: '2026-10-18T12:05:00.000Z',
    };
    const itemC: MockItem = {
      id: 'item-1',
      title: 'Edit 3 (Final)',
      is_completed: true,
      updated_at: '2026-10-18T12:10:00.000Z',
    };

    // (A merge B) merge C
    const ab = resolveLWW(itemA, itemB).winningRecord;
    const abc = resolveLWW(ab, itemC).winningRecord;

    // A merge (B merge C)
    const bc = resolveLWW(itemB, itemC).winningRecord;
    const a_bc = resolveLWW(itemA, bc).winningRecord;

    expect(abc.title).toBe('Edit 3 (Final)');
    expect(a_bc.title).toBe('Edit 3 (Final)');
    expect(abc).toEqual(a_bc);
  });

  it('guarantees soft-delete tombstones prevail over older edits', () => {
    const editItem: MockItem = {
      id: 'item-1',
      title: 'Renamed habit',
      is_completed: true,
      updated_at: '2026-10-18T09:00:00.000Z',
      deleted_at: null,
    };
    const deletedItem: MockItem = {
      id: 'item-1',
      title: 'Old habit',
      is_completed: false,
      updated_at: '2026-10-18T09:15:00.000Z',
      deleted_at: '2026-10-18T09:15:00.000Z',
    };

    const res = resolveLWW(editItem, deletedItem);
    expect(res.winner).toBe('remote');
    expect(res.winningRecord.deleted_at).toBe('2026-10-18T09:15:00.000Z');
  });

  it('throws an error if comparing entities with mismatched IDs', () => {
    const itemA: MockItem = {
      id: 'item-1',
      title: 'A',
      is_completed: false,
      updated_at: '2026-10-18T10:00:00.000Z',
    };
    const itemB: MockItem = {
      id: 'item-2',
      title: 'B',
      is_completed: false,
      updated_at: '2026-10-18T10:00:00.000Z',
    };
    expect(() => resolveLWW(itemA, itemB)).toThrow('Cannot resolve LWW conflict between different IDs');
  });
});
