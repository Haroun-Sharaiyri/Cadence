import { isItemCheckedToday } from '../../../src/domain/rollover.ts';

// Simulate an item checked yesterday (2026-10-17)
const itemInDb = {
  id: 'test-1',
  list_type: 'today_morning',
  title: 'Drink water',
  sort_order: 1000,
  is_completed: true,
  completed_at: '2026-10-17T08:00:00.000Z',
  last_completed_day: '2026-10-17',
  created_at: '2026-10-17T07:00:00.000Z',
  updated_at: '2026-10-17T08:00:00.000Z',
  deleted_at: null,
};

const today = '2026-10-18';

// 1. What does the UI display to the user?
const visuallyChecked = isItemCheckedToday(itemInDb, today);
console.log('UI display state (isItemCheckedToday):', visuallyChecked);

// 2. User sees unchecked box and clicks to check it.
// Here is repository.ts line 108:
const isCompleted = !itemInDb.is_completed;
console.log('New isCompleted calculated by repository.ts:', isCompleted);

const updatedItem = {
  ...itemInDb,
  is_completed: isCompleted,
  completed_at: isCompleted ? new Date().toISOString() : null,
  last_completed_day: isCompleted ? today : null,
};

console.log('UI display state after first click:', isItemCheckedToday(updatedItem, today));
if (!isItemCheckedToday(updatedItem, today)) {
  console.log('>>> BUG CONFIRMED: Clicking unchecked item did NOT check it! <<<');
}
