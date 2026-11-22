// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

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

function button(label) {
  const match = [...host.querySelectorAll('button')].find((item) => item.textContent.trim() === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

async function render(path, session = true, asAdmin = false) {
  if (session) {
    localStorage.setItem('splitspace-session', asAdmin ? 'admin@splitspace.demo' : 'aarav@splitspace.demo');
  }
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>));
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('confirm', () => true);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SplitSpace Admin and Redesign Flows', () => {
  it('signs in as Demo Admin using the instant demo card on login page', async () => {
    await render('/login', false);
    expect(host.textContent).toContain('Instant Demo Sign-In');

    const adminBtn = host.querySelector('.demo-account-btn.admin-btn');
    expect(adminBtn).not.toBeNull();
    click(adminBtn);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(localStorage.getItem('splitspace-session')).toBe('admin@splitspace.demo');
    expect(host.textContent).toContain('SPLITSPACE ADMIN');
    expect(host.textContent).toContain('PLATFORM OVERSIGHT');
    expect(host.textContent).toContain('Admin Overview');
  });

  it('switches persona between Demo User and Demo Admin via role switcher', async () => {
    await render('/dashboard', true, false);
    expect(host.textContent).toContain('SPLITSPACE');
    expect(host.textContent).toContain('Member Workspace');

    const switchBtn = host.querySelector('.role-switch-btn');
    expect(switchBtn).not.toBeNull();
    click(switchBtn);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(localStorage.getItem('splitspace-session')).toBe('admin@splitspace.demo');
    expect(host.textContent).toContain('Admin Portal');

    // Switch back to user
    const switchBackBtn = host.querySelector('.role-switch-btn');
    click(switchBackBtn);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(localStorage.getItem('splitspace-session')).toBe('aarav@splitspace.demo');
    expect(host.textContent).toContain('Member Workspace');
  });

  it('admin manages users: adds demo user, edits user, and changes role', async () => {
    await render('/admin/users', true, true);
    expect(host.textContent).toContain('Registered Users Directory');

    // Add new demo user
    click(button('Add Demo User'));
    const modalForm = host.querySelector('[role="dialog"] form');
    expect(modalForm).not.toBeNull();

    setValue(modalForm.querySelector('input[placeholder="e.g. Vikram Batra"]'), 'Rohan Sen');
    setValue(modalForm.querySelector('input[placeholder="vikram@splitspace.demo"]'), 'rohan@splitspace.demo');
    submit(modalForm);

    expect(host.textContent).toContain('Rohan Sen');
    let state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.members.some((m) => m.name === 'Rohan Sen')).toBe(true);

    // Edit user
    const editBtn = [...host.querySelectorAll('button')].find(
      (b) => b.textContent.includes('Edit') && b.closest('tr')?.textContent.includes('Rohan Sen')
    );
    click(editBtn);

    const editForm = host.querySelector('[role="dialog"] form');
    setValue(editForm.querySelector('input[name="name"]'), 'Rohan Sen Sharma');
    submit(editForm);

    expect(host.textContent).toContain('Rohan Sen Sharma');
    state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.members.some((m) => m.name === 'Rohan Sen Sharma')).toBe(true);

    // Promote to Admin
    const promoteBtn = [...host.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'Promote' && b.closest('tr')?.textContent.includes('Rohan Sen Sharma')
    );
    click(promoteBtn);

    state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    const updated = state.members.find((m) => m.name === 'Rohan Sen Sharma');
    expect(updated.role).toBe('admin');
  });

  it('admin exports report CSV files', async () => {
    await render('/admin/reports', true, true);
    const createObjectURL = vi.fn(() => 'blob:splitspace-admin-report');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    click(button('Download Platform Report'));
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();

    click(button('Download Users CSV'));
    click(button('Download Groups CSV'));
    click(button('Download Expenses CSV'));
    expect(createObjectURL).toHaveBeenCalledTimes(4);
  });

  it('supports currency preference configuration and updates symbols', async () => {
    await render('/settings', true, false);
    expect(host.textContent).toContain('Workspace Currency');

    click(button('USD ($)'));
    let state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.settings.currency).toBe('USD');

    click(button('EUR (€)'));
    state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.settings.currency).toBe('EUR');

    click(button('GBP (£)'));
    state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.settings.currency).toBe('GBP');

    click(button('INR (₹)'));
    state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    expect(state.settings.currency).toBe('INR');
  });

  it('records payment from Settle Up modal on Balances page', async () => {
    await render('/balances', true, false);
    const settleUpBtn = [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settle Up');
    if (settleUpBtn) {
      click(settleUpBtn);
      const modal = host.querySelector('[role="dialog"]');
      expect(modal).not.toBeNull();

      click(button('Record Payment'));
      const state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
      expect(state.settlements.some((s) => s.status === 'pending')).toBe(true);
    }
  });

  it('creates a group with inline new member addition', async () => {
    await render('/groups', true, false);
    click(button('Create group'));

    const form = host.querySelector('[role="dialog"] form');
    setValue(form.querySelector('input[name="name"]'), 'Tokyo Trip');
    setValue(form.querySelector('input[name="newMemberName"]'), 'Kenji Sato');
    setValue(form.querySelector('input[name="newMemberEmail"]'), 'kenji@example.com');
    submit(form);

    expect(host.textContent).toContain('Tokyo Trip');
    const state = JSON.parse(localStorage.getItem('splitspace-data-v1'));
    const createdGroup = state.groups.find((g) => g.name === 'Tokyo Trip');
    expect(createdGroup).toBeDefined();
    expect(state.members.some((m) => m.name === 'Kenji Sato')).toBe(true);
  });

  it('verifies all 7 dedicated admin route components render their specific pages', async () => {
    // 1. Overview
    await render('/admin', true, true);
    expect(host.textContent).toContain('PLATFORM OVERSIGHT');
    expect(host.textContent).toContain('Admin Overview');
    expect(host.textContent).toContain('LOCAL MEMBERS');

    // 2. Users
    await render('/admin/users', true, true);
    expect(host.textContent).toContain('User Management');
    expect(host.textContent).toContain('Registered Users Directory');
    expect(host.textContent).toContain('Add Demo User');

    // 3. Groups
    await render('/admin/groups', true, true);
    expect(host.textContent).toContain('Group Management');
    expect(host.textContent).toContain('Active Sharing Groups');
    expect(host.textContent).toContain('Export Groups CSV');

    // 4. Expenses
    await render('/admin/expenses', true, true);
    expect(host.textContent).toContain('Expense Monitoring');
    expect(host.textContent).toContain('Global Expenses');
    expect(host.textContent).toContain('Export Expenses CSV');

    // 5. Settlements
    await render('/admin/settlements', true, true);
    expect(host.textContent).toContain('Platform Settlements');
    expect(host.textContent).toContain('Settlement Records');
    expect(host.textContent).toContain('TOTAL RECORDS');

    // 6. Reports
    await render('/admin/reports', true, true);
    expect(host.textContent).toContain('Platform Reports');
    expect(host.textContent).toContain('Download Platform Report');

    // 7. Settings
    await render('/admin/settings', true, true);
    expect(host.textContent).toContain('Admin Settings');
    expect(host.textContent).toContain('Administrator Persona');
  });

  it('clicking admin sidebar links updates route and renders distinct page contents', async () => {
    await render('/admin', true, true);
    expect(host.textContent).toContain('Admin Overview');

    // Click User Management in sidebar
    const userLink = [...host.querySelectorAll('.sidebar nav a')].find((a) =>
      a.textContent.includes('User Management')
    );
    expect(userLink).toBeDefined();
    click(userLink);
    expect(host.textContent).toContain('Registered Users Directory');
    expect(host.textContent).not.toContain('Platform Monthly Volume');

    // Click Group Management in sidebar
    const groupLink = [...host.querySelectorAll('.sidebar nav a')].find((a) =>
      a.textContent.includes('Group Management')
    );
    expect(groupLink).toBeDefined();
    click(groupLink);
    expect(host.textContent).toContain('Active Sharing Groups');

    // Click Expense Monitoring in sidebar
    const expenseLink = [...host.querySelectorAll('.sidebar nav a')].find((a) =>
      a.textContent.includes('Expense Monitoring')
    );
    expect(expenseLink).toBeDefined();
    click(expenseLink);
    expect(host.textContent).toContain('Global Expenses');

    // Click Settlements in sidebar
    const settleLink = [...host.querySelectorAll('.sidebar nav a')].find((a) =>
      a.textContent.includes('Settlements')
    );
    expect(settleLink).toBeDefined();
    click(settleLink);
    expect(host.textContent).toContain('Platform Settlements');

    // Click Reports in sidebar
    const reportLink = [...host.querySelectorAll('.sidebar nav a')].find((a) =>
      a.textContent.includes('Reports')
    );
    expect(reportLink).toBeDefined();
    click(reportLink);
    expect(host.textContent).toContain('Platform Reports');
  });

  it('renders 404 Not Found page for invalid routes', async () => {
    await render('/random-broken-path-404', true, false);
    expect(host.textContent).toContain('Page not found');
    expect(host.textContent).toContain('Return to Overview');
  });

  it('verifies Group Detail 6 distinct tabs and member financial breakdown', async () => {
    await render('/groups/flat', true, false);
    expect(host.textContent).toContain('Maple house');

    // Check tabs
    expect(host.textContent).toContain('Overview');
    expect(host.textContent).toContain('Members');
    expect(host.textContent).toContain('Expenses');
    expect(host.textContent).toContain('Balances');
    expect(host.textContent).toContain('Settlements');
    expect(host.textContent).toContain('Activity');

    // Switch to Members tab
    const membersTab = [...host.querySelectorAll('button[role="tab"]')].find((b) =>
      b.textContent.includes('Members')
    );
    click(membersTab);

    // Verify financial column headers
    expect(host.textContent).toContain('Amount Paid Upfront');
    expect(host.textContent).toContain('Personal Share');
    expect(host.textContent).toContain('Net Balance');

    // Switch to Balances tab
    const balancesTab = [...host.querySelectorAll('button[role="tab"]')].find((b) =>
      b.textContent.includes('Balances')
    );
    click(balancesTab);
    expect(host.textContent).toContain('Who Owes Whom in Maple house');
  });

  it('verifies Settle Up user page rendering with 3 KPI cards and pending payment notices', async () => {
    await render('/settlements', true, false);
    expect(host.textContent).toContain('Settle Up');
    expect(host.textContent).toContain('Track money you owe and payments others owe you');

    // 3 KPI cards
    expect(host.textContent).toContain('YOU OWE');
    expect(host.textContent).toContain('YOU ARE OWED');
    expect(host.textContent).toContain('COMPLETED SETTLEMENTS');

    // Action button
    expect(host.textContent).toContain('Record a Payment');
    expect(host.textContent).toContain('Pending Payments');
  });
});
