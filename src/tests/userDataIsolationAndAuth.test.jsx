// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { getData, registerUser } from '../services/store';

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
  const match = [...host.querySelectorAll('button')].find((item) => item.textContent.trim().includes(label));
  if (!match) throw new Error(`Button not found with label: ${label}`);
  return match;
}

async function render(path, userEmail = null) {
  if (userEmail) {
    localStorage.setItem('splitspace-session', userEmail);
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

describe('SplitSpace User Data Isolation, Admin Access Control, and Auth Redesign', () => {
  // -------------------------------------------------------------------------
  // 1. DATA ISOLATION TESTS
  // -------------------------------------------------------------------------
  it('registers a new user and confirms an empty workspace with 0 records', async () => {
    await render('/register', null);
    expect(host.textContent).toContain('Create your workspace');
    expect(host.textContent).toContain('Guaranteed Data Isolation');

    const form = host.querySelector('form');
    setValue(form.querySelector('input[name="name"]'), 'Vinayak Padalti');
    setValue(form.querySelector('input[name="email"]'), 'vinayak@example.com');
    setValue(form.querySelector('input[name="password"]'), 'Secret123!');
    submit(form);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(localStorage.getItem('splitspace-session')).toBe('vinayak@example.com');
    expect(host.textContent).toContain('Good');
    expect(host.textContent).toContain('Vinayak');

    // Verify raw workspace in storage
    const userWorkspace = getData('vinayak@example.com');
    expect(userWorkspace.groups).toHaveLength(0);
    expect(userWorkspace.expenses).toHaveLength(0);
    expect(userWorkspace.settlements).toHaveLength(0);
    expect(userWorkspace.notifications).toHaveLength(0);
    expect(userWorkspace.recurringExpenses).toHaveLength(0);
    expect(userWorkspace.invitations).toHaveLength(0);

    // Verify UI KPI metrics on Dashboard
    expect(host.textContent).toContain('TOTAL YOU OWE');
    expect(host.textContent).toContain('TOTAL YOU ARE OWED');
    expect(host.textContent).toContain('TOTAL GROUPS');
    expect(host.textContent).toContain('TOTAL EXPENSES');

    // Verify empty state messages
    expect(host.textContent).toContain("You haven't joined any groups yet");
    expect(host.textContent).toContain('Nothing here yet');
  });

  it('verifies complete data isolation between two distinct accounts', async () => {
    // 1. Register user Vinayak
    const regResult = registerUser({
      name: 'Vinayak Padalti',
      email: 'vinayak@test.com',
      password: 'password123'
    });
    expect(regResult.success).toBe(true);
    expect(regResult.user.id).toBeDefined();

    // 2. Render Vinayak's dashboard and create a group
    await render('/groups', 'vinayak@test.com');
    expect(host.textContent).toContain('My Groups');
    expect(host.textContent).toContain('Active groups you belong to');
    expect(host.textContent).toContain('You haven’t joined any groups yet');

    click(button('Create group'));
    const groupForm = host.querySelector('[role="dialog"] form');
    setValue(groupForm.querySelector('input[name="name"]'), 'Vinayak Private Flat');
    submit(groupForm);

    expect(host.textContent).toContain('Vinayak Private Flat');
    const vinayakDataAfterGroup = getData('vinayak@test.com');
    expect(vinayakDataAfterGroup.groups).toHaveLength(1);
    expect(vinayakDataAfterGroup.groups[0].name).toBe('Vinayak Private Flat');

    // Unmount Vinayak
    await act(async () => root.unmount());
    root = undefined; host.remove(); host = undefined;

    // 3. Log in as Demo User Aarav
    await render('/groups', 'aarav@splitspace.demo');
    expect(host.textContent).toContain('Goa escape');
    expect(host.textContent).toContain('Maple house');
    // Critical: Aarav MUST NOT see Vinayak's group!
    expect(host.textContent).not.toContain('Vinayak Private Flat');

    // Unmount Aarav
    await act(async () => root.unmount());
    root = undefined; host.remove(); host = undefined;

    // 4. Log back in as Vinayak
    await render('/groups', 'vinayak@test.com');
    // Vinayak MUST see his own group and NOT Aarav's groups!
    expect(host.textContent).toContain('Vinayak Private Flat');
    expect(host.textContent).not.toContain('Goa escape');
    expect(host.textContent).not.toContain('Maple house');
  });

  // -------------------------------------------------------------------------
  // 2. DEMO ADMIN ACCESS CONTROL TESTS
  // -------------------------------------------------------------------------
  it('strictly redirects non-admin user from /admin to /dashboard', async () => {
    // Demo user Aarav attempts to access /admin
    await render('/admin', 'aarav@splitspace.demo');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    // Must be redirected to dashboard Overview
    expect(host.textContent).toContain('WORKSPACE / Overview');
    expect(host.textContent).toContain('YOUR FINANCIAL OVERVIEW');
    expect(host.textContent).not.toContain('ADMIN CONSOLE / Admin Overview');
  });

  it('hides admin links and role switch button for normal users', async () => {
    await render('/dashboard', 'aarav@splitspace.demo');
    // Normal user Aarav must NOT see Switch to Admin or Admin Console link
    expect(host.querySelector('.role-switch-btn')).toBeNull();
    expect(host.querySelector('.admin-demo-link')).toBeNull();
    expect(host.querySelector('.topbar-member-badge')).not.toBeNull();
    expect(host.querySelector('.topbar-role-pill')).toBeNull();
  });

  it('allows Demo Admin full access to Admin Console and role switching', async () => {
    await render('/admin', 'admin@splitspace.demo');
    expect(host.textContent).toContain('ADMIN CONSOLE / Admin Overview');
    expect(host.textContent).toContain('SPLITSPACE ADMIN');
    expect(host.textContent).toContain('Admin Portal');

    // Admin has role switch button
    const switchBtn = host.querySelector('.role-switch-btn');
    expect(switchBtn).not.toBeNull();
    expect(switchBtn.textContent).toContain('Switch to User');

    // Topbar role pill is present and interactive
    const topbarPill = host.querySelector('.topbar-role-pill');
    expect(topbarPill).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 3. AUTHENTICATION UI & VALIDATION TESTS
  // -------------------------------------------------------------------------
  it('prevents duplicate email registration and shows a clear error message', async () => {
    await render('/register', null);
    const form = host.querySelector('form');
    // Attempt to register with Aarav's existing email
    setValue(form.querySelector('input[name="name"]'), 'Aarav Imposter');
    setValue(form.querySelector('input[name="email"]'), 'aarav@splitspace.demo');
    setValue(form.querySelector('input[name="password"]'), 'secret456');
    submit(form);

    expect(host.textContent).toContain('An account with this email already exists. Please sign in instead.');
  });

  it('validates password matching on registration', async () => {
    await render('/register', null);
    const form = host.querySelector('form');
    setValue(form.querySelector('input[name="name"]'), 'New User');
    setValue(form.querySelector('input[name="email"]'), 'newuser@example.com');
    setValue(form.querySelector('input[name="password"]'), 'password123');
    setValue(form.querySelector('input[name="confirmPassword"]'), 'differentPassword');
    submit(form);

    expect(host.textContent).toContain('Passwords do not match');
  });

  it('toggles password visibility with eye button', async () => {
    await render('/login', null);
    const passwordInput = host.querySelector('input[name="password"]');
    expect(passwordInput.type).toBe('password');

    const toggleBtn = host.querySelector('.password-toggle-btn');
    expect(toggleBtn).not.toBeNull();

    click(toggleBtn);
    expect(passwordInput.type).toBe('text');

    click(toggleBtn);
    expect(passwordInput.type).toBe('password');
  });

  it('renders Forgot Password view and simulates recovery flow', async () => {
    await render('/forgot-password', null);
    expect(host.textContent).toContain('Reset your password');
    expect(host.textContent).toContain('ACCOUNT RECOVERY');

    const form = host.querySelector('form');
    setValue(form.querySelector('input[name="email"]'), 'forgotten@example.com');
    submit(form);

    expect(host.textContent).toContain('Password reset instructions simulated for forgotten@example.com');
  });
});
