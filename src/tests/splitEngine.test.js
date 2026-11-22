import { describe, expect, it } from 'vitest';
import { calculateBalances, customSplit, equalSplit, percentageSplit, simplifyDebts } from '../utils/splitEngine';
describe('split engine', () => {
  it('splits equally and assigns the remainder', () => expect(equalSplit(1000, ['a','b','c'])).toEqual({a:334,b:333,c:333}));
  it('splits ₹1,200 equally between four participants', () => expect(equalSplit(120000, ['a','b','c','d'])).toEqual({a:30000,b:30000,c:30000,d:30000}));
  it('allocates ₹100 in paise without losing the remainder', () => expect(Object.values(equalSplit(10000, ['a','b','c']))).toEqual([3334,3333,3333]));
  it('handles percentage splits precisely', () => expect(percentageSplit(120000, {a:25,b:75})).toEqual({a:30000,b:90000}));
  it('splits ₹1,000 by 50/30/20 percent', () => expect(percentageSplit(100000, {a:50,b:30,c:20})).toEqual({a:50000,b:30000,c:20000}));
  it('normalizes accepted percentage tolerance without losing paise', () => expect(Object.values(percentageSplit(1000000000, {a:50.0005,b:49.9995})).reduce((sum, value) => sum + value, 0)).toBe(1000000000));
  it('rejects percentages that do not total 100', () => expect(() => percentageSplit(100, {a:90,b:9})).toThrow());
  it('rejects negative or non-numeric percentages', () => { expect(() => percentageSplit(100, {a:-1,b:101})).toThrow(); expect(() => percentageSplit(100, {a:'nope',b:100})).toThrow(); });
  it('requires custom splits to equal the total', () => expect(() => customSplit(1000, {a:4,b:5})).toThrow());
  it('rejects the incomplete ₹500 + ₹300 + ₹100 custom split of ₹1,000', () => expect(() => customSplit(100000, {a:500,b:300,c:100})).toThrow());
  it('calculates ₹1,200 payer net +₹900 and three shares at -₹300', () => expect(calculateBalances([{amount:120000,paidBy:'a',shares:{a:30000,b:30000,c:30000,d:30000}}])).toEqual({a:90000,b:-30000,c:-30000,d:-30000}));
  it('calculates and simplifies balances', () => { const balances = calculateBalances([{amount:1200,paidBy:'a',shares:{a:400,b:400,c:400}}]); expect(balances).toEqual({a:800,b:-400,c:-400}); expect(simplifyDebts(balances)).toEqual([{from:'b',to:'a',amount:400},{from:'c',to:'a',amount:400}]); });
  it('accounts for confirmed settlements and ignores pending settlements', () => {
    const expenses = [{amount:1200,paidBy:'a',shares:{a:400,b:400,c:400}}];
    expect(calculateBalances(expenses, [{from:'b',to:'a',amount:200,status:'pending'}])).toEqual({a:800,b:-400,c:-400});
    expect(calculateBalances(expenses, [{from:'b',to:'a',amount:200,status:'settled'}])).toEqual({a:600,b:-200,c:-400});
  });
});
