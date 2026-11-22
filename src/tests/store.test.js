// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialData } from '../data/demo';
import { getData, getStorageWarning, getTheme, resetData, saveData, saveTheme } from '../services/store';

beforeEach(() => localStorage.clear());

describe('local demo store', () => {
  it('initializes fresh browser storage with seeded state', () => {
    expect(getData().expenses).toHaveLength(initialData.expenses.length);
    expect(getData().members).toHaveLength(initialData.members.length);
  });

  it('restores and persists group, expense, settlement, notification and preference state', () => {
    const state = getData();
    const changed = { ...state, groups: [{ id: 'g', name: 'New group', members: ['me'] }], expenses: [{ id: 'receipt-expense', receipt: { name: 'proof.pdf', type: 'application/pdf', size: 40, dataUrl: 'data:application/pdf;base64,AA==' } }], settlements: [], notifications: [], recurringExpenses: [{ id: 'repeat-1', interval: 'monthly', nextDueDate: '2026-05-01' }], settings: { notifications: { expenseUpdates: false } } };
    saveData(changed);
    expect(getData()).toMatchObject(changed);
    expect(getData().expenses[0].receipt.dataUrl).toContain('base64');
    expect(getData().recurringExpenses).toHaveLength(1);
  });

  it('recovers safely from malformed JSON and incomplete schemas', () => {
    localStorage.setItem('splitspace-data-v1', '{broken');
    expect(getData().groups).toEqual(initialData.groups);
    localStorage.setItem('splitspace-data-v1', JSON.stringify({ groups: [] }));
    expect(getData().expenses).toEqual(initialData.expenses);
  });

  it('normalizes theme defaults and persists a selected appearance', () => {
    expect(getTheme()).toBe('light');
    saveTheme('dark');
    expect(getTheme()).toBe('dark');
  });

  it('resets the local workspace to fresh demo records', () => {
    saveData({ ...getData(), expenses: [] });
    expect(resetData().expenses).toHaveLength(initialData.expenses.length);
  });

  it('reports Local Storage quota failures and clears the warning after a successful save', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    expect(saveData(getData())).toBe(false);
    expect(getStorageWarning()).toContain('could not save');
    setItem.mockRestore();
    expect(saveData(getData())).toBe(true);
    expect(getStorageWarning()).toBe('');
  });
});
