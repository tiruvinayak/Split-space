import { describe, expect, it } from 'vitest';
import { advanceRecurrenceDate, validateRecurrence } from '../utils/recurrence';
import { initialData } from '../data/demo';
import { processDueRecurring, upsertRecurringSchedule } from '../utils/workspace';

const baseSchedule = (overrides = {}) => ({
  id: 'recurring-1', groupId: 'weekend', description: 'Weekly groceries', category: 'Shopping',
  amount: 10000, paidBy: 'me', shares: { me: 5000, zoe: 5000 }, interval: 'daily',
  startDate: '2026-01-01', endDate: '2026-01-03', nextDueDate: '2026-01-01', active: true,
  anchorDay: 1, anchorMonth: 1, ...overrides,
});
const clone = (value) => JSON.parse(JSON.stringify(value));

describe('recurring schedules', () => {
  it('advances daily, weekly, monthly and yearly dates with calendar clamping', () => {
    expect(advanceRecurrenceDate('2026-01-01', 'daily')).toBe('2026-01-02');
    expect(advanceRecurrenceDate('2026-01-01', 'weekly')).toBe('2026-01-08');
    expect(advanceRecurrenceDate('2026-01-31', 'monthly', { day: 31 })).toBe('2026-02-28');
    expect(advanceRecurrenceDate('2026-02-28', 'monthly', { day: 31 })).toBe('2026-03-31');
    expect(advanceRecurrenceDate('2024-02-29', 'yearly', { day: 29, month: 2 })).toBe('2025-02-28');
  });

  it('validates interval, dates, safe paise totals and group participants', () => {
    const validate = (schedule) => validateRecurrence({ ...schedule, memberIds: ['me', 'zoe'] });
    expect(validate(baseSchedule())).toBe(true);
    expect(() => validate(baseSchedule({ interval: 'hourly' }))).toThrow();
    expect(() => validate(baseSchedule({ endDate: '2025-12-31' }))).toThrow();
    expect(() => validate(baseSchedule({ amount: 10001 }))).toThrow();
    expect(() => validate(baseSchedule({ shares: { me: 5000, maya: 5000 } }))).toThrow();
  });

  it('generates each due period once, advances next due date and stops at end date', () => {
    const state = { ...clone(initialData), recurringExpenses: [baseSchedule()] };
    let nextId = 0;
    const generated = processDueRecurring(state, '2026-01-03', () => `generated-${++nextId}`);
    expect(generated.expenses.filter((item) => item.recurringId === 'recurring-1').map((item) => item.recurrencePeriod)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(generated.recurringExpenses[0]).toMatchObject({ nextDueDate: '2026-01-04', active: false });
    const again = processDueRecurring(generated, '2026-01-03', () => `duplicate-${++nextId}`);
    expect(again.expenses.filter((item) => item.recurringId === 'recurring-1')).toHaveLength(3);
    expect(nextId).toBe(4); // Three expense IDs and one summary notification ID.
  });

  it('deduplicates a period even when a stale next-due pointer is encountered', () => {
    const state = { ...clone(initialData), recurringExpenses: [baseSchedule({ endDate: null, nextDueDate: '2026-01-01' })], expenses: [{ id: 'existing', recurringId: 'recurring-1', recurrencePeriod: '2026-01-01' }] };
    let nextId = 0;
    const result = processDueRecurring(state, '2026-01-01', () => `new-${++nextId}`);
    expect(result.expenses.filter((item) => item.recurrencePeriod === '2026-01-01')).toHaveLength(1);
    expect(nextId).toBe(0);
    expect(result.recurringExpenses[0].nextDueDate).toBe('2026-01-02');
  });

  it('upserts schedules and validates selected participants against the group', () => {
    const state = { ...clone(initialData), recurringExpenses: [] };
    const created = upsertRecurringSchedule(state, baseSchedule());
    expect(created.recurringExpenses).toHaveLength(1);
    expect(upsertRecurringSchedule(created, baseSchedule({ description: 'Updated name' })).recurringExpenses).toHaveLength(1);
    expect(() => upsertRecurringSchedule(state, baseSchedule({ shares: { me: 5000, maya: 5000 } }))).toThrow();
  });
});
