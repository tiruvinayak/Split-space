// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { initialData } from '../data/demo';
import { formatMoney } from '../utils/money';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
let host;

function click(element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}
function submit(form) {
  act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
function setValue(element, value) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  act(() => {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function selectFile(input, file) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
function button(label) {
  const match = [...host.querySelectorAll('button')].find((item) => item.textContent.trim() === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}
async function render(path, session = true) {
  if (session) {
    const isTargetAdmin = path.startsWith('/admin');
    localStorage.setItem('splitspace-session', isTargetAdmin ? 'admin@splitspace.demo' : 'demo');
  }
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>));
}

beforeEach(() => { localStorage.clear(); vi.stubGlobal('confirm', () => true); });
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove(); root = undefined; host = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('SplitSpace app interactions', () => {
  it('adds, edits, searches, and deletes an expense through the UI', async () => {
    await render('/expenses');
    const createObjectURL = vi.fn(() => 'blob:splitspace-test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    click(button('Add expense'));
    const form = host.querySelector('[role="dialog"] form');
    setValue(form.querySelector('input[placeholder="e.g. Sunday brunch"]'), 'QA lunch');
    setValue(form.querySelector('input[type="number"]'), '12.50');
    submit(form);
    expect(host.textContent).toContain('QA lunch');
    let saved = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    const created = saved.expenses.find((item) => item.description === 'QA lunch');
    expect(created.amount).toBe(1250);

    click(host.querySelector('[aria-label="Edit QA lunch"]'));
    const editForm = host.querySelector('[role="dialog"] form');
    setValue(editForm.querySelector('input[type="number"]'), '15.00');
    submit(editForm);
    saved = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(saved.expenses.find((item) => item.id === created.id).amount).toBe(1500);

    const search = host.querySelector('input[placeholder="Search description, category, payer"]');
    setValue(search, 'not present');
    expect(host.textContent).toContain('No matching expenses');
    setValue(search, '');
    const selectors = host.querySelectorAll('.list-toolbar select');
    setValue(selectors[2], 'amount-desc');
    expect(host.querySelector('.expense-row .expense-title b').textContent).toBe('Villa stay');
    setValue(selectors[0], 'Utilities');
    expect(host.querySelectorAll('.expense-row')).toHaveLength(1);
    expect(host.querySelector('.expense-row .expense-title b').textContent).toBe('November utilities');
    setValue(selectors[0], 'All categories');
    setValue(search, 'QA lunch');
    click(button('Export CSV'));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchorClick).toHaveBeenCalledOnce();
    click(host.querySelector('[aria-label="Delete QA lunch"]'));
    saved = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(saved.expenses.some((item) => item.id === created.id)).toBe(false);
  });

  it('creates and deletes a group with its expenses from the group screen', async () => {
    await render('/groups');
    click(button('Create group'));
    const form = host.querySelector('[role="dialog"] form');
    const nameInput = form.querySelector('input[name="name"]');
    setValue(nameInput, 'QA hiking trip');
    expect(nameInput.value).toBe('QA hiking trip');
    submit(form);
    expect(host.textContent).toContain('QA hiking trip');
    const group = JSON.parse(localStorage.getItem('splitspace-data-v1')).groups.find((item) => item.name === 'QA hiking trip');
    expect(group.members).toContain('me');
    let groupCard = [...host.querySelectorAll('.group-card-wrap')].find((item) => item.textContent.includes('QA hiking trip'));
    click([...groupCard.querySelectorAll('button')].find((item) => item.textContent.includes('Edit')));
    const editForm = host.querySelector('[role="dialog"] form');
    setValue(editForm.querySelector('input[name="name"]'), 'QA mountain weekend');
    submit(editForm);
    expect(host.textContent).toContain('QA mountain weekend');
    groupCard = [...host.querySelectorAll('.group-card-wrap')].find((item) => item.textContent.includes('QA mountain weekend'));
    click([...groupCard.querySelectorAll('button')].find((item) => item.textContent.includes('Delete')));
    expect(JSON.parse(localStorage.getItem('splitspace-data-v1')).groups.some((item) => item.id === group.id)).toBe(false);
  });

  it('adds and removes a member through a simulated group invitation', async () => {
    await render('/groups/flat');
    click(button('Invite member'));
    expect(host.textContent).toContain('Zoe Harper');
    click(button('Add'));
    let state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.groups.find((item) => item.id === 'flat').members).toContain('zoe');
    expect(state.invitations.at(-1)).toMatchObject({ memberId: 'zoe', status: 'accepted' });
    click(host.querySelector('[aria-label="Remove Zoe Harper"]'));
    state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.groups.find((item) => item.id === 'flat').members).not.toContain('zoe');
  });

  it('confirms a pending settlement and persists updated balances', async () => {
    await render('/settlements');
    click(button('Confirm payment'));
    const state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.settlements[0].status).toBe('settled');
    expect(state.notifications[0].title).toBe('Settlement confirmed');
  });

  it('redirects a logged-out visitor and lets the demo login establish a session', async () => {
    await render('/expenses', false);
    expect(host.textContent).toContain('Sign in to your space.');
    const form = host.querySelector('form');
    submit(form);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(localStorage.getItem('splitspace-session')).toBe('aarav@splitspace.demo');
    expect(host.textContent).toContain('Overview');
  });

  it('registers a local demo profile and opens the workspace', async () => {
    await render('/register', false);
    const form = host.querySelector('form');
    setValue(form.querySelector('input[name="name"]'), 'Riya Shah');
    setValue(form.querySelector('input[name="email"]'), 'riya@example.test');
    setValue(form.querySelector('input[name="password"]'), 'demo-password');
    submit(form);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(localStorage.getItem('splitspace-session')).toBe('riya@example.test');
    expect(JSON.parse(localStorage.getItem('splitspace-data-v1')).user.name).toBe('Riya Shah');
    expect(host.textContent).toContain('Overview');
  });

  it('persists profile, theme and notification preferences and logs out', async () => {
    await render('/settings');
    click(button('Edit profile'));
    const form = host.querySelector('[role="dialog"] form');
    setValue(form.querySelector('input[name="name"]'), 'Avery Mehta');
    click(button('Save profile'));
    expect(JSON.parse(localStorage.getItem('splitspace-data-v1')).user.name).toBe('Avery Mehta');
    click(button('Dark'));
    expect(localStorage.getItem('splitspace-theme')).toBe('dark');
    click(host.querySelector('input[aria-label="Expense updates"]'));
    expect(JSON.parse(localStorage.getItem('splitspace-data-v1')).settings.notifications.expenseUpdates).toBe(false);
    click(button('Log out'));
    expect(localStorage.getItem('splitspace-session')).toBeNull();
    expect(host.textContent).toContain('Sign in to your space.');
  });

  it('marks an individual notification read and deletes it', async () => {
    await render('/notifications');
    const firstUnread = JSON.parse(localStorage.getItem('splitspace-data-v1')).notifications.find((item) => !item.read);
    click(button('Mark read'));
    expect(JSON.parse(localStorage.getItem('splitspace-data-v1')).notifications.find((item) => item.id === firstUnread.id).read).toBe(true);
    click(host.querySelector(`[aria-label="Delete notification: ${firstUnread.title}"]`));
    expect(JSON.parse(localStorage.getItem('splitspace-data-v1')).notifications.some((item) => item.id === firstUnread.id)).toBe(false);
  });

  it('previews a local PDF, replaces it with an image and removes the receipt', async () => {
    await render('/expenses');
    click(button('Add expense'));
    let form = host.querySelector('[role="dialog"] form');
    setValue(form.querySelector('input[placeholder="e.g. Sunday brunch"]'), 'Receipt test');
    setValue(form.querySelector('input[type="number"]'), '9.00');
    await selectFile(form.querySelector('input[type="file"]'), new File(['pdf receipt'], 'receipt.pdf', { type: 'application/pdf' }));
    expect(host.querySelector('object[aria-label="Receipt PDF preview"]')).not.toBeNull();
    submit(form);
    let saved = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    const expense = saved.expenses.find((item) => item.description === 'Receipt test');
    expect(expense.receipt.name).toBe('receipt.pdf');

    click(host.querySelector('[aria-label="Edit Receipt test"]'));
    form = host.querySelector('[role="dialog"] form');
    await selectFile(form.querySelector('input[type="file"]'), new File(['image receipt'], 'receipt.png', { type: 'image/png' }));
    expect(host.querySelector('img[alt="Receipt for Receipt test"]')).not.toBeNull();
    click(button('Remove'));
    submit(form);
    saved = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(saved.expenses.find((item) => item.id === expense.id)).not.toHaveProperty('receipt');
  });

  it('creates a weekly recurring schedule, generates its due occurrence once and pauses it', async () => {
    await render('/expenses');
    click(button('Schedule expense'));
    const form = host.querySelector('[role="dialog"] form');
    setValue(form.querySelector('input[placeholder="e.g. Sunday brunch"]'), 'Weekly produce');
    setValue(form.querySelector('input[type="number"]'), '24.00');
    const interval = [...form.querySelectorAll('select')].find((select) => [...select.options].some((option) => option.value === 'weekly'));
    setValue(interval, 'weekly');
    submit(form);
    let state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    const schedule = state.recurringExpenses.find((item) => item.description === 'Weekly produce');
    expect(schedule).toMatchObject({ interval: 'weekly', active: true, nextDueDate: expect.any(String) });
    expect(state.expenses.filter((item) => item.recurringId === schedule.id)).toHaveLength(1);
    click(button('Check due schedules'));
    state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.expenses.filter((item) => item.recurringId === schedule.id)).toHaveLength(1);
    click(button('Pause'));
    state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.recurringExpenses.find((item) => item.id === schedule.id).active).toBe(false);
  });

  it('shows dashboard and admin totals from the current persisted expenses', async () => {
    const state = JSON.parse(JSON.stringify(initialData));
    state.expenses.push({ id: 'analytics-check', groupId: 'goa', description: 'Analytics check', category: 'Food', amount: 123456, paidBy: 'me', shares: { me: 123456 }, date: new Date().toISOString().slice(0, 10) });
    localStorage.setItem('splitspace-data-v1', JSON.stringify(state));
    await render('/dashboard');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    const expectedTotal = state.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    expect(host.textContent).toContain(formatMoney(expectedTotal));
    await act(async () => root.unmount());
    root = undefined; host.remove(); host = undefined;
    await render('/admin');
    expect(host.textContent).toContain(formatMoney(expectedTotal));
    expect(host.textContent).toContain('Recorded activity');
  });
});
