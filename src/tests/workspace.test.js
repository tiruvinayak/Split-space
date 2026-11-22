import { describe, expect, it } from 'vitest';
import { initialData } from '../data/demo';
import { addGroupMember, confirmSettlement, filterAndSortExpenses, getExpenseAnalytics, removeExpense, removeGroup, upsertExpense } from '../utils/workspace';

const data = () => JSON.parse(JSON.stringify(initialData));

describe('workspace workflows', () => {
  it('creates and edits an expense without duplicating its record, then deletes it', () => {
    const state = data();
    const newExpense = { id: 'new-expense', groupId: 'goa', amount: 2500, description: 'Coffee', date: '2026-11-22', paidBy: 'me', shares: { me: 2500 } };
    const created = upsertExpense(state, newExpense);
    expect(created.expenses[0]).toEqual(newExpense);
    const changed = upsertExpense(created, { ...newExpense, description: 'Tea' });
    expect(changed.expenses.filter((item) => item.id === newExpense.id)).toHaveLength(1);
    expect(removeExpense(changed, newExpense.id).expenses.some((item) => item.id === newExpense.id)).toBe(false);
  });

  it('filters expense records and sorts by the selected order', () => {
    const state = data();
    const filtered = filterAndSortExpenses(state.expenses, { query: 'food', category: 'All categories', groupId: 'all', sort: 'amount-asc', memberName: (id) => state.members.find((person) => person.id === id)?.name || '' });
    expect(filtered.map((item) => item.id)).toEqual(['e1']);
    expect(filterAndSortExpenses(state.expenses, { category: 'Utilities', groupId: 'flat' }).map((item) => item.id)).toEqual(['e3']);
  });

  it('removes a group and its expenses while preserving other groups', () => {
    const result = removeGroup(data(), 'goa');
    expect(result.groups.some((item) => item.id === 'goa')).toBe(false);
    expect(result.expenses.some((item) => item.groupId === 'goa')).toBe(false);
    expect(result.groups.map((item) => item.id)).toEqual(['flat', 'weekend']);
  });

  it('adds a local group member and invitation record, respecting notification preferences', () => {
    const state = data();
    const updated = addGroupMember(state, 'flat', 'zoe', 'invite-1', '2026-11-22');
    expect(updated.groups.find((group) => group.id === 'flat').members).toContain('zoe');
    expect(updated.invitations[0]).toMatchObject({ groupId: 'flat', memberId: 'zoe', status: 'accepted' });
    const quiet = addGroupMember({ ...state, settings: { notifications: { groupUpdates: false } } }, 'flat', 'zoe', 'invite-2', '2026-11-22');
    expect(quiet.notifications).toEqual(state.notifications);
  });

  it('confirms a pending transfer once and updates the financial state', () => {
    const state = {
      ...data(),
      expenses: [{ id: 'debt', amount: 12000, paidBy: 'a', date: '2026-11-01', shares: { a: 0, b: 12000 } }],
      settlements: [{ id: 'pending-1', from: 'b', to: 'a', amount: 5000, status: 'pending', date: '2026-11-20' }],
      user: { id: 'b', name: 'Bee' }, settings: { notifications: { settlementUpdates: true } }, notifications: [],
    };
    const confirmed = confirmSettlement(state, 'pending-1', { nextId: 'notice-1', date: '2026-11-22' });
    expect(confirmed.settlements[0]).toMatchObject({ amount: 5000, status: 'settled', confirmedAt: '2026-11-22' });
    expect(confirmSettlement(confirmed, 'pending-1', { nextId: 'notice-2', date: '2026-11-23' })).toBe(confirmed);
    expect(getExpenseAnalytics(confirmed, new Date('2026-11-22T12:00:00Z')).balances).toMatchObject({ a: 7000, b: -7000 });
  });

  it('keeps derived dashboard and admin metrics tied to current demo records', () => {
    const state = data();
    const analytics = getExpenseAnalytics(state, new Date('2026-11-22T12:00:00Z'));
    expect(analytics.totalSpend).toBe(state.expenses.reduce((sum, expense) => sum + expense.amount, 0));
    expect(analytics.monthCount).toBe(state.expenses.filter((expense) => expense.date.startsWith('2026-11')).length);
    expect(Object.values(analytics.categorySpend).reduce((sum, amount) => sum + amount, 0)).toBe(analytics.totalSpend);
  });
});
