import { initialData } from '../data/demo';

const LEGACY_KEY = 'splitspace-data-v1';
const USERS_KEY = 'splitspace-users';
const SESSION_KEY = 'splitspace-session';
const THEME_KEY = 'splitspace-theme';
const WORKSPACE_PREFIX = 'splitspace-workspace-';

let storageWarning = '';
const storageListeners = new Set();

export const DEFAULT_USERS = [
  {
    id: 'me',
    name: 'Aarav Mehta',
    email: 'aarav@splitspace.demo',
    password: 'demo',
    role: 'user',
    initials: 'AM',
    color: '#6366f1',
    status: 'active',
    registeredAt: '2026-01-01'
  },
  {
    id: 'admin',
    name: 'System Admin',
    email: 'admin@splitspace.demo',
    password: 'admin',
    role: 'admin',
    initials: 'AD',
    color: '#dc2626',
    status: 'active',
    registeredAt: '2026-01-01'
  }
];

const cloneInitialData = () => JSON.parse(JSON.stringify(initialData));

const updateStorageWarning = (message) => {
  if (storageWarning === message) return;
  storageWarning = message;
  storageListeners.forEach((listener) => listener());
};

export const getStorageWarning = () => storageWarning;
export const subscribeStorageWarning = (listener) => {
  storageListeners.add(listener);
  return () => storageListeners.delete(listener);
};

export const isValidData = (value) =>
  Boolean(
    value &&
      typeof value === 'object' &&
      value.user &&
      Array.isArray(value.groups) &&
      Array.isArray(value.expenses) &&
      Array.isArray(value.notifications) &&
      Array.isArray(value.settlements)
  );

export const getRegisteredUsers = () => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return [...DEFAULT_USERS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return [...DEFAULT_USERS];
    }
    const merged = [...parsed];
    for (const def of DEFAULT_USERS) {
      if (!merged.some((u) => u.email.toLowerCase() === def.email.toLowerCase())) {
        merged.push(def);
      }
    }
    return merged;
  } catch {
    return [...DEFAULT_USERS];
  }
};

export const findUserByEmail = (email) => {
  if (!email) return null;
  const users = getRegisteredUsers();
  return users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
};

export const createEmptyWorkspace = (user) => ({
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: user.initials || 'U',
    color: user.color || '#6366f1',
    role: 'user',
    status: 'active'
  },
  members: [
    {
      id: user.id,
      name: user.name,
      email: user.email,
      initials: user.initials || 'U',
      color: user.color || '#6366f1',
      role: 'user',
      status: 'active'
    }
  ],
  groups: [],
  expenses: [],
  settlements: [],
  notifications: [],
  invitations: [],
  recurringExpenses: [],
  settings: {
    currency: 'INR',
    notifications: {
      expenseUpdates: true,
      groupUpdates: true,
      settlementUpdates: true
    }
  }
});

export const registerUser = ({ name, email, password }) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanPassword = String(password || '');

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Full name must be at least 2 characters.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!cleanPassword || cleanPassword.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters long.' };
  }

  const existing = findUserByEmail(cleanEmail);
  if (existing) {
    return {
      success: false,
      error: 'An account with this email already exists. Please sign in instead.'
    };
  }

  const initials = cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const colors = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#06b6d4'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Normal registered users are STRICTLY assigned role 'user'. Never 'admin'.
  const newUser = {
    id,
    name: cleanName,
    email: cleanEmail,
    password: cleanPassword,
    role: 'user',
    initials,
    color,
    status: 'active',
    registeredAt: new Date().toISOString().slice(0, 10)
  };

  try {
    const users = getRegisteredUsers();
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Save strictly to user's isolated workspace key
    const emptyWorkspace = createEmptyWorkspace(newUser);
    localStorage.setItem(`${WORKSPACE_PREFIX}${id}`, JSON.stringify(emptyWorkspace));
    localStorage.setItem(SESSION_KEY, cleanEmail);
    // Mirror active user to legacy key for legacy test readers
    localStorage.setItem(LEGACY_KEY, JSON.stringify(emptyWorkspace));

    return { success: true, user: newUser };
  } catch {
    return {
      success: false,
      error: 'Failed to save account to local storage. Storage may be full.'
    };
  }
};

export const resolveActiveUser = (userEmailOrId) => {
  let target = userEmailOrId;
  if (!target) {
    try {
      target = localStorage.getItem(SESSION_KEY);
    } catch {
      target = null;
    }
  }

  if (
    !target ||
    target === 'demo' ||
    target === 'me' ||
    target.toLowerCase() === 'aarav@splitspace.demo'
  ) {
    return DEFAULT_USERS[0]; // Aarav Mehta
  }

  if (target === 'admin' || target.toLowerCase() === 'admin@splitspace.demo') {
    return DEFAULT_USERS[1]; // System Admin
  }

  const users = getRegisteredUsers();
  const found = users.find(
    (u) => u.email.toLowerCase() === target.toLowerCase() || u.id === target
  );

  return found || DEFAULT_USERS[0];
};

const normalizeWorkspace = (parsed, user) => {
  const defaults = cloneInitialData();
  const isDemo = user.id === 'me' || user.id === 'admin';

  let members = Array.isArray(parsed.members) ? [...parsed.members] : isDemo ? [...defaults.members] : [user];
  if (!members.some((m) => m.id === user.id || m.email?.toLowerCase() === user.email.toLowerCase())) {
    members.unshift(user);
  }

  return {
    user: parsed.user || user,
    members,
    groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
    notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    invitations: Array.isArray(parsed.invitations) ? parsed.invitations : [],
    recurringExpenses: Array.isArray(parsed.recurringExpenses) ? parsed.recurringExpenses : [],
    settings: {
      currency: parsed.settings?.currency || defaults.settings.currency || 'INR',
      notifications: {
        ...defaults.settings.notifications,
        ...(parsed.settings?.notifications || {})
      }
    }
  };
};

export const getData = (userEmailOrId) => {
  const user = resolveActiveUser(userEmailOrId);
  const workspaceKey = `${WORKSPACE_PREFIX}${user.id}`;

  try {
    // If Admin: loads platform dataset from global store / initial data
    if (user.id === 'admin') {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (isValidData(parsed)) {
            const adminMember =
              (parsed.members || []).find((m) => m.id === 'admin' || m.role === 'admin') ||
              DEFAULT_USERS[1];
            return normalizeWorkspace({ ...parsed, user: adminMember }, user);
          }
        } catch {
          /* fallthrough */
        }
      }
      const seeded = cloneInitialData();
      const adminMember = seeded.members.find((m) => m.id === 'admin') || DEFAULT_USERS[1];
      return { ...seeded, user: adminMember };
    }

    // If Demo User Aarav: check his isolated workspace first
    if (user.id === 'me') {
      const stored = localStorage.getItem(workspaceKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          isValidData(parsed) &&
          (parsed.user?.id === 'me' || parsed.user?.email === 'aarav@splitspace.demo')
        ) {
          return normalizeWorkspace(parsed, user);
        }
      }
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (
            isValidData(parsed) &&
            (parsed.user?.id === 'me' || parsed.user?.email === 'aarav@splitspace.demo')
          ) {
            const aaravMember =
              (parsed.members || []).find((m) => m.id === 'me') || DEFAULT_USERS[0];
            const normalized = normalizeWorkspace({ ...parsed, user: aaravMember }, user);
            localStorage.setItem(workspaceKey, JSON.stringify(normalized));
            return normalized;
          }
        } catch {
          /* fallthrough */
        }
      }
      const seeded = cloneInitialData();
      localStorage.setItem(workspaceKey, JSON.stringify(seeded));
      return seeded;
    }

    // For any newly registered user: strictly load from their isolated workspace key
    const stored = localStorage.getItem(workspaceKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (isValidData(parsed)) {
        return normalizeWorkspace(parsed, user);
      }
    }

    // Clean empty workspace for newly registered user
    const empty = createEmptyWorkspace(user);
    localStorage.setItem(workspaceKey, JSON.stringify(empty));
    return empty;
  } catch {
    return user.id === 'me' || user.id === 'admin'
      ? cloneInitialData()
      : createEmptyWorkspace(user);
  }
};

export const saveData = (data, userEmailOrId) => {
  const user = resolveActiveUser(userEmailOrId || data?.user?.id || data?.user?.email);
  const workspaceKey = `${WORKSPACE_PREFIX}${user.id}`;

  try {
    localStorage.setItem(workspaceKey, JSON.stringify(data));
    // Mirror active workspace to legacy key
    localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
    updateStorageWarning('');
    return true;
  } catch {
    updateStorageWarning(
      'This browser could not save your latest changes. Remove a receipt or free local storage, then try again.'
    );
    return false;
  }
};

export const resetData = (userEmailOrId) => {
  const user = resolveActiveUser(userEmailOrId);
  const workspaceKey = `${WORKSPACE_PREFIX}${user.id}`;
  try {
    localStorage.removeItem(workspaceKey);
  } catch {
    /* ignore */
  }

  if (user.id === 'me') {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
    const reset = cloneInitialData();
    try {
      localStorage.setItem(workspaceKey, JSON.stringify(reset));
      localStorage.setItem(LEGACY_KEY, JSON.stringify(reset));
    } catch {
      /* ignore */
    }
    return reset;
  }

  const empty = createEmptyWorkspace(user);
  try {
    localStorage.setItem(workspaceKey, JSON.stringify(empty));
    localStorage.setItem(LEGACY_KEY, JSON.stringify(empty));
  } catch {
    /* ignore */
  }
  return empty;
};

export const getTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const saveTheme = (theme) => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* Theme still applies for this session */
  }
};
