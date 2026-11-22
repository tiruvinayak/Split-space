import { useState, useMemo } from 'react';
import { customSplit, equalSplit, percentageSplit } from '../utils/splitEngine';
import { fromPaise, toPaise, formatMoney, getCurrencySymbol } from '../utils/money';
import { validateRecurrence } from '../utils/recurrence';
import { readReceiptDataUrl, validateReceiptFile } from '../utils/receipt';
import { Check, AlertCircle, FileText, UploadCloud, RefreshCw, X } from 'lucide-react';

const categories = ['Food', 'Travel', 'Rent', 'Shopping', 'Utilities', 'Entertainment', 'Education', 'Transportation', 'Other'];

export default function ExpenseForm({
  groups = [],
  members = [],
  initial,
  onSave,
  onClose,
  forceRecurring = false,
  storedReceiptBytes = 0,
  currency = 'INR'
}) {
  const [form, setForm] = useState(() => initial ? {
    ...initial,
    date: initial.interval ? initial.startDate : initial.date,
    amount: fromPaise(initial.amount),
    method: initial.method || 'equal'
  } : {
    description: '',
    amount: '',
    groupId: groups[0]?.id || '',
    category: 'Food',
    paidBy: 'me',
    method: 'equal',
    date: new Date().toISOString().slice(0, 10),
  });

  const group = groups.find((item) => item.id === form.groupId) || groups[0];
  const groupIds = group?.members || [];

  const [participants, setParticipants] = useState(() => {
    if (initial?.shares) {
      return Object.keys(initial.shares).filter((id) => groupIds.includes(id));
    }
    return groupIds.length ? groupIds : ['me'];
  });

  const [allocations, setAllocations] = useState(() => {
    if (initial?.shares && form.method !== 'equal') {
      return Object.fromEntries(
        Object.entries(initial.shares).map(([id, amount]) => [
          id,
          form.method === 'custom' ? fromPaise(amount) : ''
        ])
      );
    }
    return {};
  });

  const [isRecurring, setIsRecurring] = useState(forceRecurring || Boolean(initial?.interval));
  const [interval, setInterval] = useState(initial?.interval || 'monthly');
  const [endDate, setEndDate] = useState(initial?.endDate || '');
  const [receipt, setReceipt] = useState(initial?.receipt || null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [error, setError] = useState('');

  const groupMembers = members.filter((person) => groupIds.includes(person.id));
  const currencySymbol = getCurrencySymbol(currency);

  const setField = (key, value) => setForm((curr) => ({ ...curr, [key]: value }));

  const toggleParticipant = (id) => {
    setParticipants((curr) =>
      curr.includes(id) ? curr.filter((item) => item !== id) : [...curr, id]
    );
  };

  const selectAllParticipants = () => setParticipants(groupIds);
  const deselectAllParticipants = () => setParticipants([]);

  // Calculate live split preview
  const liveSplitPreview = useMemo(() => {
    try {
      const numAmount = Number(form.amount);
      if (!numAmount || numAmount <= 0 || participants.length === 0) return null;
      const paise = toPaise(numAmount);
      const splitInput = Object.fromEntries(participants.map((id) => [id, allocations[id] ?? '']));

      let shares = {};
      if (form.method === 'equal') {
        shares = equalSplit(paise, participants);
      } else if (form.method === 'percentage') {
        shares = percentageSplit(paise, splitInput);
      } else {
        shares = customSplit(paise, splitInput);
      }
      return { shares, valid: true };
    } catch (err) {
      return { error: err.message, valid: false };
    }
  }, [form.amount, form.method, participants, allocations]);

  // Handle receipt selection
  const selectReceipt = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      validateReceiptFile(file, storedReceiptBytes, receipt?.size || 0);
      setReceiptLoading(true);
      setError('');
      const dataUrlObj = await readReceiptDataUrl(file);
      setReceipt(dataUrlObj);
    } catch (exception) {
      setError(exception.message || 'The receipt could not be added.');
    } finally {
      setReceiptLoading(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    try {
      if (!form.description.trim()) throw new Error('Add a description for this expense.');
      if (!form.date) throw new Error('Choose the date of this expense.');
      if (!form.amount || Number(form.amount) <= 0) throw new Error('Enter a valid amount greater than 0.');
      if (participants.length === 0) throw new Error('Select at least one participant.');

      const amount = toPaise(form.amount);
      const splitInput = Object.fromEntries(participants.map((id) => [id, allocations[id] ?? '']));
      const shares = form.method === 'equal'
        ? equalSplit(amount, participants)
        : form.method === 'percentage'
        ? percentageSplit(amount, splitInput)
        : customSplit(amount, splitInput);

      if (!groupIds.includes(form.paidBy)) throw new Error('Select a payer from the group members.');

      if (isRecurring) {
        const [, month, day] = form.date.split('-').map(Number);
        validateRecurrence({
          interval,
          startDate: form.date,
          endDate: endDate || null,
          amount,
          shares,
          memberIds: groupIds
        });
        const sameStart = initial?.interval && initial.startDate === form.date;
        onSave({
          schedule: {
            id: initial?.interval ? initial.id : crypto.randomUUID(),
            description: form.description.trim(),
            amount,
            groupId: form.groupId,
            category: form.category,
            paidBy: form.paidBy,
            shares,
            method: form.method,
            interval,
            startDate: form.date,
            endDate: endDate || null,
            nextDueDate: sameStart ? initial.nextDueDate : form.date,
            active: initial?.interval ? initial.active !== false : true,
            anchorDay: day,
            anchorMonth: month,
            createdAt: initial?.createdAt || new Date().toISOString(),
          }
        });
      } else {
        const expenseData = { ...form };
        delete expenseData.receipt;
        onSave({
          ...expenseData,
          description: form.description.trim(),
          amount,
          shares,
          id: initial?.id || crypto.randomUUID(),
          date: form.date,
          ...(receipt ? { receipt } : {})
        });
      }
      setError('');
    } catch (exception) {
      setError(exception.message || 'Check the expense details and try again.');
    }
  };

  return (
    <form className="form-grid expense-form-stepped" onSubmit={submit} noValidate>
      {/* Step 1: Which group */}
      <div className="form-step-section full">
        <div className="form-step-title">
          <span className="step-num">1</span>
          <div>
            <strong>Which group is this expense for?</strong>
            <small>Only members of this group will be eligible for splitting.</small>
          </div>
        </div>
        <select
          required
          value={form.groupId}
          onChange={(event) => {
            const nextGroupId = event.target.value;
            const nextGroup = groups.find((item) => item.id === nextGroupId);
            const nextMembers = nextGroup?.members || [];
            setForm((current) => ({
              ...current,
              groupId: nextGroupId,
              paidBy: nextMembers.includes(current.paidBy) ? current.paidBy : nextMembers[0] || 'me'
            }));
            setParticipants(nextMembers);
            setAllocations({});
          }}
        >
          {groups.map((item) => (
            <option key={item.id} value={item.id}>
              {item.emoji} {item.name} ({item.category})
            </option>
          ))}
        </select>
      </div>

      {/* Step 2: What was purchased & Date */}
      <div className="form-step-section full">
        <div className="form-step-title">
          <span className="step-num">2</span>
          <div>
            <strong>What was purchased?</strong>
            <small>Provide a clear description and pick a category.</small>
          </div>
        </div>
        <div className="fields-inline-grid">
          <label className="span-2">
            Description
            <input
              required
              maxLength="80"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="e.g. Sunday brunch"
            />
          </label>
          <label>
            Category
            <select
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setField('date', e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Step 3: Who paid & How much */}
      <div className="form-step-section full">
        <div className="form-step-title">
          <span className="step-num">3</span>
          <div>
            <strong>Who paid and how much?</strong>
            <small>The payer fronted the total bill.</small>
          </div>
        </div>
        <div className="fields-inline-grid">
          <label>
            Paid by
            <select
              required
              value={form.paidBy}
              onChange={(e) => setField('paidBy', e.target.value)}
            >
              {groupMembers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} {person.id === 'me' ? '(You)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Total Amount ({currencySymbol})
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(e) => setField('amount', e.target.value)}
              placeholder="0.00"
            />
          </label>
        </div>
      </div>

      {/* Step 4: Who participated */}
      <div className="form-step-section full">
        <div className="form-step-title">
          <span className="step-num">4</span>
          <div>
            <strong>Who shared this expense?</strong>
            <small>Select all people who benefited.</small>
          </div>
          <div className="participant-quick-actions">
            <button type="button" className="text-button" onClick={selectAllParticipants}>Select all</button>
            <span>·</span>
            <button type="button" className="text-button" onClick={deselectAllParticipants}>Clear</button>
          </div>
        </div>
        <div className="participant-options">
          {groupMembers.map((person) => (
            <label key={person.id} className="participant-badge">
              <input
                type="checkbox"
                checked={participants.includes(person.id)}
                onChange={() => toggleParticipant(person.id)}
              />
              <span>{person.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Step 5: How should it be split */}
      <div className="form-step-section full">
        <div className="form-step-title">
          <span className="step-num">5</span>
          <div>
            <strong>How should it be split?</strong>
            <small>Choose equal shares, percentage breakdown, or custom exact amounts.</small>
          </div>
        </div>
        <div className="split-method-tabs">
          {['equal', 'percentage', 'custom'].map((method) => (
            <button
              type="button"
              key={method}
              className={`split-tab ${form.method === method ? 'active' : ''}`}
              onClick={() => setField('method', method)}
            >
              {method === 'equal' && 'Equal Split (=)'}
              {method === 'percentage' && 'By Percentage (%)'}
              {method === 'custom' && 'Exact Amounts (₹)'}
            </button>
          ))}
        </div>

        {form.method !== 'equal' && (
          <div className="allocation-inputs-card">
            <p className="field-label">
              {form.method === 'percentage'
                ? 'Enter percentage for each participant (must sum to 100%)'
                : 'Enter exact amount for each participant (must equal total amount)'}
            </p>
            {groupMembers
              .filter((person) => participants.includes(person.id))
              .map((person) => (
                <div key={person.id} className="allocation-row">
                  <span>{person.name}</span>
                  <div className="input-with-affix">
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={allocations[person.id] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAllocations((curr) => ({ ...curr, [person.id]: val }));
                      }}
                      placeholder={form.method === 'percentage' ? '0' : '0.00'}
                    />
                    <span className="affix">{form.method === 'percentage' ? '%' : currencySymbol}</span>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Live Split Preview Box */}
        {liveSplitPreview && liveSplitPreview.valid && (
          <div className="live-split-preview" aria-label="Split preview">
            <div className="preview-header">
              <Check size={15} />
              <strong>Live Split Breakdown</strong>
              <span>({participants.length} {participants.length === 1 ? 'person' : 'people'})</span>
            </div>
            <div className="preview-chips">
              {Object.entries(liveSplitPreview.shares).map(([id, sharePaise]) => {
                const member = members.find((m) => m.id === id);
                return (
                  <div key={id} className="preview-chip">
                    <span className="chip-name">{member?.name || id}:</span>
                    <span className="chip-amount">{formatMoney(sharePaise, currency)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {liveSplitPreview && !liveSplitPreview.valid && liveSplitPreview.error && (
          <div className="live-split-warning">
            <AlertCircle size={15} />
            <span>{liveSplitPreview.error}</span>
          </div>
        )}
      </div>

      {/* Step 6: Recurrence & Receipts */}
      <div className="form-step-section full">
        <div className="form-step-title">
          <span className="step-num">6</span>
          <div>
            <strong>Repeat & Receipt Attachments (Optional)</strong>
            <small>Schedule recurring charges or attach receipts.</small>
          </div>
        </div>

        {forceRecurring || initial?.interval ? (
          <p className="recurrence-hint">
            Editing recurring schedule. Occurrences will be created automatically when due.
          </p>
        ) : (
          <label className="recurring-checkbox-label">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            <span>Repeat this expense on a recurring schedule</span>
          </label>
        )}

        {isRecurring && (
          <div className="recurrence-fields-grid">
            <label>
              Repeats
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              >
                {['daily', 'weekly', 'monthly', 'yearly'].map((val) => (
                  <option key={val} value={val}>{val[0].toUpperCase() + val.slice(1)}</option>
                ))}
              </select>
            </label>
            <label>
              End date (optional)
              <input
                type="date"
                min={form.date}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            <p className="recurrence-hint full">
              First due on {form.date}. Advances automatically upon each due date.
            </p>
          </div>
        )}

        {!isRecurring && (
          <div className="receipt-box" aria-label="Expense receipt">
            <div className="receipt-box-info">
              <FileText size={18} />
              <div>
                <strong>Attach Receipt</strong>
                <small>Local image (PNG, JPG, WebP) or PDF · max 1 MB per file</small>
              </div>
            </div>

            {receipt ? (
              <div className="receipt-preview-card">
                {receipt.type === 'application/pdf' ? (
                  <object
                    data={receipt.dataUrl}
                    type="application/pdf"
                    aria-label="Receipt PDF preview"
                    className="pdf-preview-object"
                  >
                    <p>PDF preview is unavailable. <a href={receipt.dataUrl} download={receipt.name}>Download {receipt.name}</a></p>
                  </object>
                ) : (
                  <img src={receipt.dataUrl} alt={`Receipt for ${form.description || 'this expense'}`} className="receipt-img-preview" />
                )}
                <div className="receipt-card-actions">
                  <span className="receipt-filename" title={receipt.name}>{receipt.name}</span>
                  <label className="button ghost small">
                    <UploadCloud size={14} /> Replace
                    <input
                      className="file-input-hidden"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      onChange={selectReceipt}
                    />
                  </label>
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => setReceipt(null)}
                  >
                    <X size={14} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="button ghost small receipt-picker-btn">
                <UploadCloud size={16} /> Choose receipt file
                <input
                  className="file-input-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  onChange={selectReceipt}
                />
              </label>
            )}

            {receiptLoading && <p className="form-status" role="status"><RefreshCw size={14} className="spin" /> Reading receipt…</p>}
          </div>
        )}
      </div>

      {error && (
        <div className="form-error-banner full" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="modal-actions full">
        <button type="button" className="button ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" type="submit" disabled={receiptLoading}>
          {isRecurring
            ? (initial?.interval ? 'Save schedule' : 'Create schedule')
            : (initial ? 'Save changes' : 'Add expense')}
        </button>
      </div>
    </form>
  );
}
