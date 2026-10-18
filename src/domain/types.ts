/**
 * src/domain/types.ts
 * Authoritative domain models and contracts for Cadence.
 */

export type ChecklistType = 'today_morning' | 'today_work' | 'today_evening' | 'work';

export type TodaySectionType = 'today_morning' | 'today_work' | 'today_evening';

export const TODAY_SECTIONS: readonly TodaySectionType[] = [
  'today_morning',
  'today_work',
  'today_evening',
] as const;

export const TODAY_SECTION_LABELS: Record<TodaySectionType, string> = {
  today_morning: 'Morning Routine',
  today_work: 'Work Day',
  today_evening: 'Evening Routine',
};

export interface ChecklistItem {
  id: string; // UUID v4
  user_id?: string; // Supabase auth user UUID or 'local'
  list_type: ChecklistType;
  title: string;
  sort_order: number; // Fractional index (e.g. 1000.0, 2000.0)
  is_completed: boolean;
  completed_at: string | null; // ISO 8601 UTC timestamp
  last_completed_day: string | null; // "YYYY-MM-DD" representing the logical day when checked
  created_at: string; // ISO 8601 UTC timestamp
  updated_at: string; // ISO 8601 UTC timestamp (monotonic Lamport)
  deleted_at: string | null; // ISO 8601 UTC timestamp or null (soft-delete tombstone)
}

export interface Goal {
  id: string; // UUID v4
  user_id?: string; // Supabase auth user UUID or 'local'
  statement: string; // Goal statement text
  target_date: string | null; // "YYYY-MM-DD" or null
  updated_at: string; // ISO 8601 UTC timestamp
  deleted_at: string | null; // ISO 8601 UTC timestamp or null
}

export interface UserSettings {
  user_id?: string; // Supabase auth user UUID or 'local'
  rollover_hour: number; // Integer between 0 and 23 (default 4)
  updated_at: string; // ISO 8601 UTC timestamp
}

export interface OutboxMutation {
  id?: number; // Auto-incrementing primary key in Dexie
  table_name: 'checklist_items' | 'goals' | 'user_settings';
  record_id: string;
  action: 'upsert' | 'delete';
  payload: ChecklistItem | Goal | UserSettings;
  timestamp: number; // Unix epoch ms
  retry_count: number;
  last_error?: string;
}

export interface CountdownResult {
  hasTarget: boolean;
  status: 'future' | 'today' | 'overdue' | 'none';
  daysRemaining: number;
  displayText: string;
}

export interface SectionProgress {
  completed: number;
  total: number;
  percent: number; // 0 to 100
}

export interface DayProgress {
  completed: number;
  total: number;
  percent: number; // 0 to 100
  isAllCompleted: boolean;
}
