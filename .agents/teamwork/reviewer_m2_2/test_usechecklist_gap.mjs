import { isItemCheckedToday } from '../../../src/domain/rollover.ts';

// Scenario: A user has completed items on 2026-10-17.
// The user launches the app on 2026-10-18.
const dbItem = {
  id: 'habit-1',
  user_id: 'local',
  list_type: 'today_morning',
  title: 'Morning stretch',
  sort_order: 1000.0,
  is_completed: true,
  completed_at: '2026-10-17T07:00:00.000Z',
  last_completed_day: '2026-10-17',
  created_at: '2026-10-17T06:00:00.000Z',
  updated_at: '2026-10-17T07:00:00.000Z',
  deleted_at: null,
};

const currentLogicalDay = '2026-10-18';

console.log('--- Analysis of item state in useChecklist ---');
console.log('dbItem.is_completed raw property:', dbItem.is_completed);
console.log('isItemCheckedToday(dbItem, currentLogicalDay):', isItemCheckedToday(dbItem, currentLogicalDay));

// If a component reads dbItem.is_completed directly:
const isCheckedByDirectProperty = dbItem.is_completed;
const isCheckedByHelper = isItemCheckedToday(dbItem, currentLogicalDay);

console.log('Discrepancy:', isCheckedByDirectProperty !== isCheckedByHelper);
