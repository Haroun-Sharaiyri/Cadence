/**
 * src/db/index.ts
 * Authoritative Dexie.js database schema and instance for Cadence.
 */

import Dexie, { type Table } from 'dexie';
import type { ChecklistItem, Goal, UserSettings, OutboxMutation } from '../domain/types';

export class CadenceDatabase extends Dexie {
  checklist_items!: Table<ChecklistItem, string>;
  goals!: Table<Goal, string>;
  user_settings!: Table<UserSettings, string>;
  outbox_mutations!: Table<OutboxMutation, number>;

  constructor(databaseName: string = 'cadence_db') {
    super(databaseName);
    this.version(1).stores({
      checklist_items: 'id, user_id, list_type, sort_order, is_completed, last_completed_day, updated_at, deleted_at',
      goals: 'id, user_id, updated_at, deleted_at',
      user_settings: 'user_id, rollover_hour, updated_at',
      outbox_mutations: '++id, table_name, record_id, timestamp',
    });
  }
}

export const db = new CadenceDatabase();
if (typeof window !== 'undefined') {
  (window as unknown as { __CADENCE_DB__?: CadenceDatabase }).__CADENCE_DB__ = db;
}
