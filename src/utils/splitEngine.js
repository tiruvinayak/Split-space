import { toPaise } from './money';

const assertAmount = (amount) => { if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a valid positive amount.'); };
const assertMembers = (members) => { if (!Array.isArray(members) || !members.length) throw new Error('Select at least one participant.'); if (new Set(members).size !== members.length) throw new Error('Participants must be unique.'); };

export function equalSplit(amount, memberIds) {
  assertAmount(amount); assertMembers(memberIds);
  const base = Math.floor(amount / memberIds.length); let remainder = amount % memberIds.length;
  return Object.fromEntries(memberIds.map((id) => [id, base + (remainder-- > 0 ? 1 : 0)]));
}
export function percentageSplit(amount, shares) {
  assertAmount(amount); assertMembers(Object.keys(shares || {}));
  const entries = Object.entries(shares);
  if (entries.some(([, share]) => (typeof share === 'string' && !share.trim()) || !Number.isFinite(Number(share)) || Number(share) < 0)) throw new Error('Percentages must be valid non-negative numbers.');
  const total = Object.values(shares).reduce((sum, share) => sum + Number(share), 0);
  if (Math.abs(total - 100) > 0.001) throw new Error('Percentages must add up to 100.');
  const exactShares = entries.map(([id, percent], index) => {
    const exact = amount * Number(percent) / total;
    const base = Math.floor(exact);
    return { id, base, remainder: exact - base, index };
  });
  let remaining = amount - exactShares.reduce((sum, item) => sum + item.base, 0);
  [...exactShares].sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, remaining).forEach((item) => { item.base += 1; });
  return Object.fromEntries(exactShares.map(({ id, base }) => [id, base]));
}
export function customSplit(amount, shares) {
  assertAmount(amount); assertMembers(Object.keys(shares || {}));
  if (Object.values(shares).some((value) => (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error('Custom amounts must be valid non-negative amounts.');
  const result = Object.fromEntries(Object.entries(shares).map(([id, value]) => [id, toPaise(value)]));
  if (Object.values(result).some((value) => !Number.isSafeInteger(value)) || Object.values(result).reduce((a, b) => a + b, 0) !== amount) throw new Error('Custom amounts must exactly equal the total.');
  return result;
}
export function calculateBalances(expenses, settlements = []) {
  const balances = {};
  expenses.forEach((expense) => { balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount; Object.entries(expense.shares).forEach(([id, share]) => { balances[id] = (balances[id] || 0) - share; }); });
  settlements.filter((settlement) => settlement.status === 'settled').forEach(({ from, to, amount }) => {
    balances[from] = (balances[from] || 0) + amount;
    balances[to] = (balances[to] || 0) - amount;
  });
  return balances;
}
export function simplifyDebts(balances) {
  const creditors = Object.entries(balances).filter(([, value]) => value > 0).map(([id, amount]) => ({ id, amount }));
  const debtors = Object.entries(balances).filter(([, value]) => value < 0).map(([id, amount]) => ({ id, amount: -amount })); const result = [];
  let c = 0; let d = 0;
  while (c < creditors.length && d < debtors.length) { const amount = Math.min(creditors[c].amount, debtors[d].amount); result.push({ from: debtors[d].id, to: creditors[c].id, amount }); creditors[c].amount -= amount; debtors[d].amount -= amount; if (!creditors[c].amount) c++; if (!debtors[d].amount) d++; }
  return result;
}
