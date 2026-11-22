const intervals = new Set(['daily', 'weekly', 'monthly', 'yearly']);

export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateRecurrence({ interval, startDate, endDate, nextDueDate, amount, shares, memberIds }) {
  if (!intervals.has(interval)) throw new Error('Choose a daily, weekly, monthly or yearly schedule.');
  if (!isISODate(startDate)) throw new Error('Choose a valid start date.');
  if (nextDueDate && !isISODate(nextDueDate)) throw new Error('The next due date is invalid.');
  if (endDate && (!isISODate(endDate) || endDate < startDate)) throw new Error('The end date must be a valid date on or after the start date.');
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a valid positive amount.');
  const ids = Object.keys(shares || {});
  if (!ids.length || ids.some((id) => !memberIds.includes(id))) throw new Error('Select valid group participants.');
  const values = Object.values(shares);
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0) || values.reduce((sum, value) => sum + value, 0) !== amount) {
    throw new Error('Participant shares must equal the scheduled total.');
  }
  return true;
}

export function advanceRecurrenceDate(dateString, interval, anchor = {}) {
  if (!isISODate(dateString) || !intervals.has(interval)) throw new Error('Cannot advance an invalid recurrence date.');
  const [year, month, day] = dateString.split('-').map(Number);
  const source = new Date(Date.UTC(year, month - 1, day));
  if (interval === 'daily') source.setUTCDate(source.getUTCDate() + 1);
  if (interval === 'weekly') source.setUTCDate(source.getUTCDate() + 7);
  if (interval === 'monthly') {
    const targetMonth = source.getUTCMonth() + 1;
    const targetYear = source.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;
    const targetDay = Math.min(anchor.day || day, new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate());
    source.setUTCFullYear(targetYear, normalizedMonth, targetDay);
  }
  if (interval === 'yearly') {
    const targetYear = source.getUTCFullYear() + 1;
    const targetMonth = (anchor.month ?? source.getUTCMonth() + 1) - 1;
    const targetDay = Math.min(anchor.day || day, new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate());
    source.setUTCFullYear(targetYear, targetMonth, targetDay);
  }
  return source.toISOString().slice(0, 10);
}

export const RECURRENCE_INTERVALS = [...intervals];
