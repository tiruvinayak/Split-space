import { initialData } from '../data/demo';
const key = 'splitspace-data-v1';
let storageWarning = '';
const storageListeners = new Set();
const cloneInitialData = () => JSON.parse(JSON.stringify(initialData));
const updateStorageWarning = (message) => {
  if (storageWarning === message) return;
  storageWarning = message;
  storageListeners.forEach((listener) => listener());
};
export const getStorageWarning = () => storageWarning;
export const subscribeStorageWarning = (listener) => { storageListeners.add(listener); return () => storageListeners.delete(listener); };
const isValidData = (value) => value && typeof value === 'object'
  && value.user && Array.isArray(value.groups) && Array.isArray(value.expenses)
  && Array.isArray(value.notifications) && Array.isArray(value.settlements);

export const getData = () => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return cloneInitialData();
    const parsed = JSON.parse(stored);
    if (!isValidData(parsed)) return cloneInitialData();
    const defaults = cloneInitialData();
    const members = Array.isArray(parsed.members) ? [...parsed.members] : [...defaults.members];
    if (!members.some((m) => m.id === 'admin')) {
      const adminMember = defaults.members.find((m) => m.id === 'admin');
      if (adminMember) members.push(adminMember);
    }
    return {
      ...defaults,
      ...parsed,
      members,
      settings: {
        ...defaults.settings,
        ...parsed.settings,
        currency: parsed.settings?.currency || defaults.settings.currency || 'INR',
        notifications: { ...defaults.settings.notifications, ...parsed.settings?.notifications }
      },
      invitations: Array.isArray(parsed.invitations) ? parsed.invitations : defaults.invitations || [],
      recurringExpenses: Array.isArray(parsed.recurringExpenses) ? parsed.recurringExpenses : [],
    };
  } catch {
    return cloneInitialData();
  }
};
export const saveData = (data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); updateStorageWarning(''); return true; } catch { /* Storage can be unavailable or full in private browsing. */ updateStorageWarning('This browser could not save your latest changes. Remove a receipt or free local storage, then try again.'); return false; }
};
export const resetData = () => { try { localStorage.removeItem(key); } catch { /* Keep the in-memory reset available. */ } return cloneInitialData(); };
export const getTheme = () => { try { return localStorage.getItem('splitspace-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };
export const saveTheme = (theme) => { try { localStorage.setItem('splitspace-theme', theme); } catch { /* Theme still applies for this session. */ } };
