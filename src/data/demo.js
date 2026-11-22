export const members = [
  { id: 'me', name: 'Aarav Mehta', email: 'aarav@splitspace.demo', initials: 'AM', color: '#6366f1', role: 'user', status: 'active', registeredAt: '2026-10-15' },
  { id: 'maya', name: 'Maya Chen', email: 'maya@splitspace.demo', initials: 'MC', color: '#10b981', role: 'user', status: 'active', registeredAt: '2026-10-18' },
  { id: 'leo', name: 'Leo Martins', email: 'leo@splitspace.demo', initials: 'LM', color: '#f59e0b', role: 'user', status: 'active', registeredAt: '2026-10-22' },
  { id: 'zoe', name: 'Zoe Harper', email: 'zoe@splitspace.demo', initials: 'ZH', color: '#ec4899', role: 'user', status: 'active', registeredAt: '2026-10-25' },
  { id: 'admin', name: 'System Admin', email: 'admin@splitspace.demo', initials: 'AD', color: '#4f46e5', role: 'admin', status: 'active', registeredAt: '2026-09-01' }
];

export const initialData = {
  user: members[0],
  members,
  settings: {
    currency: 'INR',
    notifications: { expenseUpdates: true, groupUpdates: true, settlementUpdates: true }
  },
  invitations: [],
  recurringExpenses: [],
  groups: [
    { id: 'goa', name: 'Goa escape', category: 'Travel', emoji: '🌊', owner: 'me', status: 'active', createdAt: '2026-11-01', members: ['me', 'maya', 'leo', 'zoe'], total: 248600, description: 'Weekend beach holiday and villa rental' },
    { id: 'flat', name: 'Maple house', category: 'Roommates', emoji: '🏠', owner: 'me', status: 'active', createdAt: '2026-11-05', members: ['me', 'maya', 'leo'], total: 85300, description: 'Shared flat rent, groceries and utilities' },
    { id: 'weekend', name: 'Weekend plans', category: 'Friends', emoji: '✨', owner: 'zoe', status: 'active', createdAt: '2026-11-10', members: ['me', 'zoe'], total: 17200, description: 'Movies, concerts, dinners and events' }
  ],
  expenses: [
    { id: 'e1', groupId: 'goa', description: 'Beachside dinner', category: 'Food', amount: 84600, paidBy: 'me', shares: { me: 21150, maya: 21150, leo: 21150, zoe: 21150 }, date: '2026-11-19' },
    { id: 'e2', groupId: 'goa', description: 'Villa stay', category: 'Travel', amount: 164000, paidBy: 'maya', shares: { me: 41000, maya: 41000, leo: 41000, zoe: 41000 }, date: '2026-11-17' },
    { id: 'e3', groupId: 'flat', description: 'November utilities', category: 'Utilities', amount: 12300, paidBy: 'leo', shares: { me: 4100, maya: 4100, leo: 4100 }, date: '2026-11-14' },
    { id: 'e4', groupId: 'flat', description: 'Groceries', category: 'Shopping', amount: 26800, paidBy: 'me', shares: { me: 8934, maya: 8933, leo: 8933 }, date: '2026-11-11' },
    { id: 'e5', groupId: 'weekend', description: 'Concert tickets', category: 'Entertainment', amount: 17200, paidBy: 'zoe', shares: { me: 8600, zoe: 8600 }, date: '2026-11-05' }
  ],
  notifications: [
    { id: 'n1', title: 'Maya added a new expense', text: 'Beachside dinner in Goa escape', read: false, date: '2026-11-19', type: 'expense' },
    { id: 'n2', title: 'Settlement reminder', text: 'You have a pending balance with Leo', read: false, date: '2026-11-20', type: 'settlement' }
  ],
  settlements: [
    { id: 's1', from: 'leo', to: 'me', amount: 10000, status: 'pending', date: '2026-11-20' }
  ]
};
