import { calculateBalances, simplifyDebts } from './splitEngine';
import { advanceRecurrenceDate, validateRecurrence } from './recurrence';

export function upsertExpense(data, expense) {
  const exists = data.expenses.some((item) => item.id === expense.id);
  return { ...data, expenses: exists ? data.expenses.map((item) => item.id === expense.id ? expense : item) : [expense, ...data.expenses] };
}

export function removeExpense(data, id) {
  return { ...data, expenses: data.expenses.filter((item) => item.id !== id) };
}

export function getStoredReceiptBytes(expenses, exceptExpenseId = null) {
  return expenses.reduce((total, expense) => total + (expense.id === exceptExpenseId ? 0 : expense.receipt?.size || 0), 0);
}

export function attachReceipt(data, expenseId, receipt) {
  return { ...data, expenses: data.expenses.map((expense) => expense.id === expenseId ? { ...expense, receipt } : expense) };
}

export function removeReceipt(data, expenseId) {
  return { ...data, expenses: data.expenses.map((expense) => {
    if (expense.id !== expenseId) return expense;
    const withoutReceipt = { ...expense };
    delete withoutReceipt.receipt;
    return withoutReceipt;
  }) };
}

export function upsertRecurringSchedule(data, schedule) {
  const previous = (data.recurringExpenses || []).find((item) => item.id === schedule.id);
  let nextSchedule = schedule;
  if (previous && previous.interval !== schedule.interval && previous.startDate === schedule.startDate) {
    const lastGenerated = data.expenses.filter((expense) => expense.recurringId === schedule.id).reduce((latest, expense) => !latest || expense.recurrencePeriod > latest ? expense.recurrencePeriod : latest, null);
    nextSchedule = { ...schedule, nextDueDate: lastGenerated ? advanceRecurrenceDate(lastGenerated, schedule.interval, { day: schedule.anchorDay, month: schedule.anchorMonth }) : schedule.startDate };
  }
  validateRecurrence({ ...nextSchedule, memberIds: data.groups.find((group) => group.id === nextSchedule.groupId)?.members || [] });
  const exists = Boolean(previous);
  return { ...data, recurringExpenses: exists
    ? data.recurringExpenses.map((item) => item.id === nextSchedule.id ? nextSchedule : item)
    : [nextSchedule, ...(data.recurringExpenses || [])] };
}

export function removeRecurringSchedule(data, id) {
  return { ...data, recurringExpenses: (data.recurringExpenses || []).filter((schedule) => schedule.id !== id) };
}

export function setRecurringScheduleActive(data, id, active) {
  return { ...data, recurringExpenses: (data.recurringExpenses || []).map((schedule) => schedule.id === id ? { ...schedule, active } : schedule) };
}

export function processDueRecurring(data, today, createId) {
  const schedules = data.recurringExpenses || [];
  let changed = false;
  const generated = [];
  const updatedSchedules = schedules.map((schedule) => {
    if (!schedule.active) return schedule;
    try {
      validateRecurrence({ ...schedule, memberIds: data.groups.find((group) => group.id === schedule.groupId)?.members || [] });
    } catch (error) {
      changed = true;
      return { ...schedule, active: false, validationError: error.message };
    }
    let dueDate = schedule.nextDueDate || schedule.startDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      changed = true;
      return { ...schedule, active: false, validationError: 'The next due date is invalid.' };
    }
    if (schedule.endDate && dueDate > schedule.endDate) {
      changed = true;
      return { ...schedule, active: false };
    }
    let periods = 0;
    while (dueDate <= today && (!schedule.endDate || dueDate <= schedule.endDate) && periods < 1000) {
      const exists = data.expenses.some((expense) => expense.recurringId === schedule.id && expense.recurrencePeriod === dueDate);
      if (!exists) {
        generated.push({
          id: createId(), groupId: schedule.groupId, description: schedule.description,
          category: schedule.category, amount: schedule.amount, paidBy: schedule.paidBy,
          shares: schedule.shares, date: dueDate, recurringId: schedule.id,
          recurrencePeriod: dueDate, generatedFrom: 'recurring',
        });
      }
      dueDate = advanceRecurrenceDate(dueDate, schedule.interval, { day: schedule.anchorDay, month: schedule.anchorMonth });
      periods += 1;
      changed = true;
    }
    const active = schedule.endDate ? dueDate <= schedule.endDate : schedule.active;
    if (active !== schedule.active) changed = true;
    return changed || dueDate !== schedule.nextDueDate ? { ...schedule, nextDueDate: dueDate, active } : schedule;
  });
  if (!changed && !generated.length) return data;
  const notifications = generated.length && data.settings?.notifications?.expenseUpdates !== false
    ? [{ id: createId(), title: 'Recurring expenses generated', text: `${generated.length} scheduled ${generated.length === 1 ? 'expense was' : 'expenses were'} added to your ledger.`, read: false, date: today }, ...data.notifications]
    : data.notifications;
  return { ...data, recurringExpenses: updatedSchedules, expenses: [...generated, ...data.expenses], notifications };
}

export function removeGroup(data, id) {
  return { ...data, groups: data.groups.filter((item) => item.id !== id), expenses: data.expenses.filter((item) => item.groupId !== id), invitations: (data.invitations || []).filter((item) => item.groupId !== id) };
}

export function addGroupMember(data, groupId, memberId, invitationId, date) {
  if (!data.members?.some((person) => person.id === memberId)) return data;
  return {
    ...data,
    groups: data.groups.map((group) => group.id === groupId ? { ...group, members: [...new Set([...group.members, memberId])] } : group),
    invitations: [...(data.invitations || []), { id: invitationId, groupId, memberId, status: 'accepted', date }],
    notifications: data.settings?.notifications?.groupUpdates === false ? data.notifications : [{ id: invitationId, title: 'Member added', text: `${data.members.find((person) => person.id === memberId).name} was added to ${data.groups.find((group) => group.id === groupId)?.name || 'the group'}.`, read: false, date }, ...data.notifications],
  };
}

export function removeGroupMember(data, groupId, memberId) {
  return {
    ...data,
    groups: data.groups.map((group) => group.id === groupId ? { ...group, members: group.members.filter((id) => id !== memberId) } : group)
  };
}

export function confirmSettlement(data, id, { nextId, date }) {
  const settlement = data.settlements.find((item) => item.id === id && item.status === 'pending');
  if (!settlement) return data;
  const debt = simplifyDebts(calculateBalances(data.expenses, data.settlements)).find((item) => item.from === settlement.from && item.to === settlement.to);
  if (!debt) return { ...data, settlements: data.settlements.map((item) => item.id === id ? { ...item, status: 'cancelled', note: 'The balance changed before confirmation.' } : item) };
  const amount = Math.min(settlement.amount, debt.amount);
  const notifications = data.settings?.notifications?.settlementUpdates === false ? data.notifications : [{ id: nextId, title: 'Settlement confirmed', text: `The simulated payment of ₹${(amount / 100).toFixed(2)} has been applied to your balances.`, read: false, date }, ...data.notifications];
  return { ...data, settlements: data.settlements.map((item) => item.id === id ? { ...item, amount, status: 'settled', confirmedAt: date } : item), notifications };
}

export function cancelSettlement(data, id) {
  return {
    ...data,
    settlements: data.settlements.map((item) => item.id === id ? { ...item, status: 'cancelled' } : item)
  };
}

export function updateMember(data, memberId, updates) {
  const updatedMembers = (data.members || []).map((m) => m.id === memberId ? { ...m, ...updates } : m);
  const updatedUser = data.user.id === memberId ? { ...data.user, ...updates } : data.user;
  return {
    ...data,
    user: updatedUser,
    members: updatedMembers
  };
}

export function addMemberDirectory(data, newMember) {
  if ((data.members || []).some((m) => m.id === newMember.id || m.email === newMember.email)) return data;
  return {
    ...data,
    members: [...(data.members || []), newMember]
  };
}

export function filterAndSortExpenses(expenses, { query = '', category = 'All categories', groupId = 'all', sort = 'date-desc', memberName = () => '' }) {
  return expenses.filter((expense) => `${expense.description} ${expense.category} ${memberName(expense.paidBy)}`.toLowerCase().includes(query.toLowerCase())
    && (category === 'All categories' || expense.category === category)
    && (groupId === 'all' || expense.groupId === groupId))
    .sort((a, b) => sort === 'amount-desc' ? b.amount - a.amount : sort === 'amount-asc' ? a.amount - b.amount : sort === 'date-asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
}

export function getExpenseAnalytics(data, date = new Date()) {
  const userId = data.user?.id || 'me';
  const balances = calculateBalances(data.expenses, data.settlements);
  const debts = simplifyDebts(balances);
  const monthKey = date.toISOString().slice(0, 7);
  const monthExpenses = data.expenses.filter((expense) => expense.date?.startsWith(monthKey));
  const categorySpend = data.expenses.reduce((totals, expense) => ({ ...totals, [expense.category]: (totals[expense.category] || 0) + expense.amount }), {});
  return {
    balances,
    debts,
    owed: debts.filter((debt) => debt.to === userId).reduce((total, debt) => total + debt.amount, 0),
    owing: debts.filter((debt) => debt.from === userId).reduce((total, debt) => total + debt.amount, 0),
    monthSpend: monthExpenses.reduce((total, expense) => total + expense.amount, 0),
    monthCount: monthExpenses.length,
    categorySpend,
    totalSpend: data.expenses.reduce((total, expense) => total + expense.amount, 0),
    pendingSpend: data.settlements.filter((item) => item.status === 'pending').reduce((total, item) => total + item.amount, 0),
  };
}
