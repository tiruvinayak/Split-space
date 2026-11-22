import { lazy, Suspense, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Handshake,
  Layers,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import ExpenseForm from '../components/ExpenseForm';
import Modal from '../components/Modal';
import { calculateBalances, simplifyDebts } from '../utils/splitEngine';
import { formatMoney, fromPaise, getCurrencySymbol, toPaise } from '../utils/money';
import {
  addGroupMember,
  removeGroupMember,
  filterAndSortExpenses,
  getExpenseAnalytics,
  getStoredReceiptBytes,
  removeGroup as removeGroupState,
  addMemberDirectory
} from '../utils/workspace';

const MonthlySpendChart = lazy(() => import('../components/AnalyticsCharts').then((module) => ({ default: module.MonthlySpendChart })));
const CategorySpendChart = lazy(() => import('../components/AnalyticsCharts').then((module) => ({ default: module.CategorySpendChart })));

const palette = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];
const categories = ['Food', 'Travel', 'Rent', 'Shopping', 'Utilities', 'Entertainment', 'Education', 'Transportation', 'Other'];
const groupCategories = ['Travel', 'Roommates', 'Friends', 'Family', 'College', 'Office', 'Project', 'Other'];

const getMember = (data, id) =>
  data.members?.find((person) => person.id === id) || {
    id,
    name: id === 'me' ? 'You' : 'Former member',
    initials: id === 'me' ? 'YO' : '?',
    color: '#94a3b8'
  };

const expenseTotal = (expenses) => expenses.reduce((sum, expense) => sum + expense.amount, 0);
const createId = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);

function MetricCard({ label, amount, tone = 'neutral', icon: Icon, note, currency = 'INR', prefix = '', isMoney = true }) {
  const displayVal = isMoney
    ? (typeof amount === 'number' ? formatMoney(amount, currency) : amount)
    : (typeof amount === 'number' ? amount.toLocaleString() : amount);
  return (
    <article className={`metric ${tone}`} aria-label={label}>
      <div className="metric-top">
        <span>{label}</span>
        <i aria-hidden="true"><Icon size={18} /></i>
      </div>
      <h2>{prefix ? `${prefix} ` : ''}{displayVal}</h2>
      <p>{note}</p>
    </article>
  );
}

function EmptyState({ title, text, action, icon: Icon = ReceiptText }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <Icon size={32} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

function monthSeries(expenses, count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const amount = expenses
      .filter((expense) => expense.date?.startsWith(key))
      .reduce((sum, expense) => sum + expense.amount, 0);
    return { month: date.toLocaleDateString('en-IN', { month: 'short' }), amount, key };
  });
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ExpenseRow({ expense, data, onEdit, onDelete, onViewReceipt }) {
  const [showCalc, setShowCalc] = useState(false);
  const group = data.groups.find((item) => item.id === expense.groupId);
  const currency = data.settings?.currency || 'INR';
  const payer = getMember(data, expense.paidBy);
  const isPaidByMe = payer.id === data.user.id;
  const userShare = expense.shares?.[data.user.id] || 0;
  const othersCombinedShares = expense.amount - (expense.shares?.[expense.paidBy] || 0);
  const othersOweYou = isPaidByMe ? (expense.amount - userShare) : 0;
  const youOwe = !isPaidByMe ? userShare : 0;

  return (
    <div className={`expense-item-container ${showCalc ? 'expanded' : ''}`} data-expense-id={expense.id}>
      <div className="expense-row">
        <span className="expense-emoji" aria-hidden="true">
          {({ Food: '🍜', Travel: '✈️', Utilities: '💡', Shopping: '🛍️', Entertainment: '🎵', Rent: '🏡', Education: '📚', Transportation: '🚕' })[expense.category] || '✦'}
        </span>
        <div className="expense-title">
          <b>
            {expense.description}
            {expense.generatedFrom === 'recurring' && (
              <span className="source-badge">Scheduled · generated</span>
            )}
          </b>
          <small>
            {group?.name || 'Deleted group'} · {expense.date} · {expense.category}
            {expense.receipt && (
              <button
                type="button"
                className="receipt-pill-link"
                onClick={() => onViewReceipt && onViewReceipt(expense)}
                title="Click to view attached receipt"
              >
                <FileText size={11} /> Receipt attached
              </button>
            )}
            <button
              type="button"
              className="calc-toggle-btn"
              onClick={() => setShowCalc(!showCalc)}
              title="Click to view financial calculation breakdown"
              aria-expanded={showCalc}
            >
              {showCalc ? 'Hide calculation ▲' : 'How is this calculated? ▼'}
            </button>
          </small>
        </div>
        <div className="paid">
          <small>{isPaidByMe ? 'Amount paid by you' : `${payer.name.split(' ')[0]} paid`}</small>
          <b>{formatMoney(expense.amount, currency)}</b>
          {!isPaidByMe && <span className="sub-label">Amount paid by you: {formatMoney(0, currency)}</span>}
        </div>
        <div className="share">
          <small>Your personal share</small>
          <b>{formatMoney(userShare, currency)}</b>
          {isPaidByMe ? (
            <span className="green-text sub-label">+{formatMoney(othersOweYou, currency)} owed to you</span>
          ) : youOwe > 0 ? (
            <span className="red-text sub-label">You owe {formatMoney(youOwe, currency)}</span>
          ) : (
            <span className="sub-label" style={{ color: 'var(--muted)' }}>Not in split</span>
          )}
        </div>
        {(onEdit || onDelete) && (
          <div className="row-actions">
            {onEdit && (
              <button
                className="row-action"
                aria-label={`Edit ${expense.description}`}
                title="Edit expense"
                onClick={() => onEdit(expense)}
              >
                <Edit3 size={15} />
              </button>
            )}
            {onDelete && (
              <button
                className="row-action delete-action"
                aria-label={`Delete ${expense.description}`}
                title="Delete expense"
                onClick={() => onDelete(expense)}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Visual Calculation Breakdown */}
      {showCalc && (
        <div className="expense-calc-breakdown" role="region" aria-label={`Calculation breakdown for ${expense.description}`}>
          <div className="calc-header">
            <strong>Financial Calculation Breakdown: {expense.description}</strong>
            <span className="badge soft">Split Method: {expense.splitMethod ? expense.splitMethod.charAt(0).toUpperCase() + expense.splitMethod.slice(1) : 'Equal'}</span>
          </div>

          <div className="calc-grid">
            <div className="calc-stat">
              <span className="calc-stat-label">Total Expense</span>
              <strong className="calc-stat-val">{formatMoney(expense.amount, currency)}</strong>
            </div>
            <div className="calc-stat">
              <span className="calc-stat-label">Paid Upfront By</span>
              <strong className="calc-stat-val">{payer.name} ({formatMoney(expense.amount, currency)})</strong>
            </div>
            <div className="calc-stat">
              <span className="calc-stat-label">{data.user.name.split(' ')[0]}'s Personal Share</span>
              <strong className="calc-stat-val">{formatMoney(userShare, currency)}</strong>
            </div>
            <div className="calc-stat">
              <span className="calc-stat-label">Others' Combined Shares</span>
              <strong className="calc-stat-val">{formatMoney(othersCombinedShares, currency)}</strong>
            </div>
          </div>

          <div className="calc-allocations-box">
            <p className="calc-subheading">ITEMIZED PARTICIPANT ALLOCATIONS (EXACT INTEGER PAISE):</p>
            <div className="calc-members-grid">
              {Object.entries(expense.shares || {}).map(([memberId, shareAmount]) => {
                const m = getMember(data, memberId);
                const isYou = memberId === data.user.id;
                const isPayer = memberId === expense.paidBy;

                return (
                  <div key={memberId} className={`calc-member-pill ${isYou ? 'you' : ''}`}>
                    <Avatar member={m} small />
                    <div className="calc-member-meta">
                      <span>{m.name}{isYou ? ' (You)' : ''}{isPayer ? ' · Payer' : ''}</span>
                      <b>{formatMoney(shareAmount, currency)}</b>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="calc-plain-summary">
            {isPaidByMe ? (
              <p>
                <strong>Financial Summary:</strong> Total expense is {formatMoney(expense.amount, currency)}. You paid {formatMoney(expense.amount, currency)} upfront. Your personal share is {formatMoney(userShare, currency)}. Other members' shares total {formatMoney(othersCombinedShares, currency)}. <strong>Amount others owe you: {formatMoney(othersOweYou, currency)}</strong> before any applicable settlements.
              </p>
            ) : userShare > 0 ? (
              <p>
                <strong>Financial Summary:</strong> Total expense is {formatMoney(expense.amount, currency)}. {payer.name} paid {formatMoney(expense.amount, currency)} upfront. Your personal share is {formatMoney(userShare, currency)}. <strong>Amount you owe {payer.name}: {formatMoney(userShare, currency)}</strong> before any applicable settlements.
              </p>
            ) : (
              <p>
                <strong>Financial Summary:</strong> Total expense is {formatMoney(expense.amount, currency)} paid by {payer.name}. You were not an allocated participant for this expense, so your balance is unchanged.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. DASHBOARD PAGE (Phase 4)
// ---------------------------------------------------------------------------
export function Dashboard({ data, addExpense }) {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [selectedReceiptExpense, setSelectedReceiptExpense] = useState(null);
  const currency = data.settings?.currency || 'INR';

  const expenses = data.expenses;
  const analytics = getExpenseAnalytics(data);
  const userId = data.user.id;
  const owing = analytics.owing;
  const owed = analytics.owed;

  const trend = useMemo(() => monthSeries(expenses), [expenses]);
  const byCategory = Object.entries(analytics.categorySpend).map(([name, value]) => ({ name, value }));
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const pendingSettlements = data.settlements.filter((s) => s.status === 'pending');
  const userPendingToReceive = pendingSettlements.filter((s) => s.to === userId);

  const dateObj = new Date();
  const currentMonthName = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const hour = dateObj.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page-content">
      {/* Top Welcome Section */}
      <div className="page-intro dashboard-intro">
        <div>
          <p className="eyebrow">YOUR FINANCIAL OVERVIEW · {currentMonthName.toUpperCase()}</p>
          <h2>{greeting}, {data.user.name.split(' ')[0]} 👋</h2>
          <p>Here is your shared spending, outstanding balances, and recent activity.</p>
        </div>
        <div className="page-actions">
          <button className="button ghost" onClick={() => navigate('/groups')}>
            <Users size={16} /> My Groups
          </button>
          <button className="button primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add expense
          </button>
        </div>
      </div>

      {/* 4 Clear Summary Cards */}
      <section className="metrics dashboard-metrics" aria-label="Key financial metrics">
        <MetricCard
          label="TOTAL YOU OWE"
          amount={owing}
          tone="warning"
          icon={TrendingDown}
          currency={currency}
          note="Outstanding across all your groups"
        />
        <MetricCard
          label="TOTAL YOU ARE OWED"
          amount={owed}
          tone="positive"
          icon={TrendingUp}
          currency={currency}
          note="To be collected from members"
        />
        <MetricCard
          label="TOTAL GROUPS"
          amount={data.groups.length}
          tone="neutral"
          icon={Users}
          isMoney={false}
          note={`${data.groups.length} active sharing ${data.groups.length === 1 ? 'circle' : 'circles'}`}
        />
        <MetricCard
          label="TOTAL EXPENSES"
          amount={expenses.length}
          tone="neutral"
          icon={ReceiptText}
          isMoney={false}
          note={`${expenses.length} shared ${expenses.length === 1 ? 'transaction' : 'transactions'} recorded`}
        />
      </section>

      {/* Quick Actions & Pending Settlements Alert */}
      {pendingSettlements.length > 0 && (
        <section className="dashboard-alert-banner" aria-label="Pending settlements alert">
          <div className="alert-content">
            <Handshake size={20} className="alert-icon" />
            <div>
              <strong>Pending Settlements ({pendingSettlements.length})</strong>
              <p>
                {userPendingToReceive.length > 0
                  ? `You have ${userPendingToReceive.length} payment confirmation request(s) awaiting your review.`
                  : `There are ${pendingSettlements.length} payment(s) awaiting confirmation.`}
              </p>
            </div>
          </div>
          <Link to="/settlements" className="button primary small">
            Review Settlements →
          </Link>
        </section>
      )}

      {/* Charts Grid */}
      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <header>
            <div>
              <p className="eyebrow">MONTHLY SPENDING</p>
              <h3>Spending Trend</h3>
            </div>
            <span className="chart-caption">Last 6 months</span>
          </header>
          {trend.some((item) => item.amount > 0) ? (
            <Suspense fallback={<p className="chart-loading" role="status">Loading chart…</p>}>
              <MonthlySpendChart data={trend} />
            </Suspense>
          ) : (
            <EmptyState
              title="No spending in this period"
              text="Add a shared expense to see your monthly volume."
              action={
                <button className="button primary small" onClick={() => setShowForm(true)}>
                  <Plus size={14} /> Add first expense
                </button>
              }
            />
          )}
        </article>

        <article className="panel category-panel">
          <header>
            <div>
              <p className="eyebrow">BY CATEGORY</p>
              <h3>Expense Breakdown</h3>
            </div>
          </header>
          {byCategory.length ? (
            <Suspense fallback={<p className="chart-loading" role="status">Loading chart…</p>}>
              <CategorySpendChart data={byCategory} total={expenseTotal(expenses)} />
            </Suspense>
          ) : (
            <EmptyState
              title="No categories yet"
              text="Your expense categories will appear here once recorded."
            />
          )}
        </article>
      </section>

      {/* Lower Grid: Groups and Recent Activity */}
      <section className="dashboard-grid lower-grid">
        {/* My Groups preview */}
        <article className="panel group-overview">
          <header>
            <div>
              <p className="eyebrow">YOUR CIRCLES</p>
              <h3>My Groups ({data.groups.length})</h3>
            </div>
            <Link className="plain-button" to="/groups">
              View all groups →
            </Link>
          </header>
          {data.groups.length ? (
            <div className="overview-groups-list">
              {data.groups.slice(0, 4).map((group) => {
                const groupExp = expenses.filter((e) => e.groupId === group.id);
                const groupSpend = expenseTotal(groupExp);
                const grpBalances = calculateBalances(groupExp);
                const myGrpBal = grpBalances[userId] || 0;

                return (
                  <Link className="overview-group-card" key={group.id} to={`/groups/${group.id}`}>
                    <span className="group-emoji">{group.emoji || '✦'}</span>
                    <div className="overview-group-info">
                      <b>{group.name}</b>
                      <small>{group.members.length} members · {group.category}</small>
                    </div>
                    <div className="overview-group-balance">
                      <strong>{formatMoney(groupSpend, currency)}</strong>
                      <small className={myGrpBal > 0 ? 'green-text' : myGrpBal < 0 ? 'red-text' : 'muted-text'}>
                        {myGrpBal > 0 ? `+${formatMoney(myGrpBal, currency)} owed`
                          : myGrpBal < 0 ? `${formatMoney(myGrpBal, currency)} owe`
                          : 'Settled'}
                      </small>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="You haven't joined any groups yet"
              text="Create your first group to start sharing expenses with friends, roommates, or travel buddies."
              action={
                <Link to="/groups" className="button primary small">
                  <Plus size={14} /> Create your first group
                </Link>
              }
            />
          )}
        </article>

        {/* Recent Expenses */}
        <article className="panel recent-panel">
          <header>
            <div>
              <p className="eyebrow">TRANSACTIONS</p>
              <h3>Recent Activity</h3>
            </div>
            <Link className="plain-button" to="/expenses">
              All expenses →
            </Link>
          </header>
          {recent.length ? (
            <div className="recent-list">
              {recent.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  data={data}
                  onViewReceipt={(e) => setSelectedReceiptExpense(e)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing here yet"
              text="Add your first shared expense to get started."
              action={
                <button className="button primary small" onClick={() => setShowForm(true)}>
                  <Plus size={14} /> Record an expense
                </button>
              }
            />
          )}
        </article>
      </section>

      {/* Add Expense Modal */}
      {showForm && (
        <Modal title="Add an expense" onClose={() => setShowForm(false)}>
          <ExpenseForm
            groups={data.groups}
            members={data.members || []}
            storedReceiptBytes={getStoredReceiptBytes(data.expenses)}
            currency={currency}
            onClose={() => setShowForm(false)}
            onSave={(expense) => {
              addExpense(expense);
              setShowForm(false);
            }}
          />
        </Modal>
      )}

      {/* Receipt View Modal */}
      {selectedReceiptExpense && selectedReceiptExpense.receipt && (
        <Modal
          title={`Receipt: ${selectedReceiptExpense.description}`}
          onClose={() => setSelectedReceiptExpense(null)}
        >
          <div className="receipt-view-modal">
            {selectedReceiptExpense.receipt.type === 'application/pdf' ? (
              <object
                data={selectedReceiptExpense.receipt.dataUrl}
                type="application/pdf"
                className="receipt-modal-object"
              >
                <p>
                  PDF preview unavailable.{' '}
                  <a href={selectedReceiptExpense.receipt.dataUrl} download={selectedReceiptExpense.receipt.name}>
                    Download {selectedReceiptExpense.receipt.name}
                  </a>
                </p>
              </object>
            ) : (
              <img
                src={selectedReceiptExpense.receipt.dataUrl}
                alt={`Receipt for ${selectedReceiptExpense.description}`}
                className="receipt-modal-image"
              />
            )}
            <div className="modal-actions">
              <a
                href={selectedReceiptExpense.receipt.dataUrl}
                download={selectedReceiptExpense.receipt.name}
                className="button ghost"
              >
                <Download size={15} /> Download
              </a>
              <button className="button primary" onClick={() => setSelectedReceiptExpense(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. GROUPS PAGE (Phase 5)
// ---------------------------------------------------------------------------
export function GroupsPage({ data, setData }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const currency = data.settings?.currency || 'INR';

  // Calculate top summary stats
  const totalGroups = data.groups.length;
  // Calculate unique members across all user groups
  const allGroupMembersSet = new Set(data.groups.flatMap((g) => g.members));
  const uniqueMembersCount = allGroupMembersSet.size;
  const totalGroupMemberships = data.groups.reduce((sum, g) => sum + g.members.length, 0);

  const totalGroupExpenses = expenseTotal(data.expenses);
  const pendingSettlements = data.settlements.filter((s) => s.status === 'pending');

  const filteredGroups = data.groups.filter((group) => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (group.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || group.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const saveGroup = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const category = String(form.get('category') || 'Travel');
    const description = String(form.get('description') || '').trim();
    const emoji = String(form.get('emoji') || '✦');
    const selected = form.getAll('members').map(String);

    if (!name) {
      setError('Please enter a group name.');
      return;
    }

    // Always include current logged-in user
    if (!selected.includes(data.user.id)) {
      selected.push(data.user.id);
    }

    // Handle new member invited inline if provided
    const newMemberName = String(form.get('newMemberName') || '').trim();
    const newMemberEmail = String(form.get('newMemberEmail') || '').trim();
    let updatedMembers = [...(data.members || [])];

    if (newMemberName) {
      const newId = `member-${createId().slice(0, 8)}`;
      const initials = newMemberName.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
      const newPerson = {
        id: newId,
        name: newMemberName,
        email: newMemberEmail || `${newId}@splitspace.demo`,
        initials: initials || 'NM',
        color: palette[updatedMembers.length % palette.length],
        role: 'user',
        status: 'active',
        registeredAt: today()
      };
      updatedMembers.push(newPerson);
      selected.push(newId);
    }

    const groupId = editing?.id || createId();
    const group = {
      id: groupId,
      name,
      category,
      description,
      emoji: emoji || editing?.emoji || '✦',
      owner: editing?.owner || data.user.id,
      status: 'active',
      createdAt: editing?.createdAt || today(),
      members: [...new Set(selected)]
    };

    const newInvitations = editing?.id
      ? (data.invitations || [])
      : [
          ...(data.invitations || []),
          ...selected
            .filter((mId) => mId !== data.user.id)
            .map((memberId) => ({
              id: createId(),
              groupId,
              memberId,
              status: 'accepted',
              date: today()
            }))
        ];

    const newNotifications = editing?.id || data.settings?.notifications?.groupUpdates === false
      ? data.notifications
      : [
          {
            id: createId(),
            title: 'Group created',
            text: `"${group.name}" was created successfully.`,
            read: false,
            date: today(),
            type: 'group'
          },
          ...data.notifications
        ];

    setData((old) => ({
      ...old,
      members: updatedMembers,
      groups: editing?.id
        ? old.groups.map((item) => (item.id === editing.id ? group : item))
        : [...old.groups, group],
      invitations: newInvitations,
      notifications: newNotifications
    }));

    setEditing(null);
    setError('');
  };

  const removeGroup = (group) => {
    if (!window.confirm(`Delete “${group.name}” and its expenses? This cannot be undone.`)) return;
    setData((old) => removeGroupState(old, group.id));
  };

  return (
    <div className="page-content">
      {/* Top Header */}
      <div className="page-intro">
        <div>
          <p className="eyebrow">YOUR CIRCLES</p>
          <h2>My Groups</h2>
          <p>Organize shared spending with roommates, trips, and friends.</p>
        </div>
        <button className="button primary" onClick={() => setEditing({})}>
          <Plus size={16} /> Create group
        </button>
      </div>

      {/* 4 Summary Cards */}
      <section className="metrics" aria-label="Groups summary metrics">
        <MetricCard
          label="TOTAL GROUPS"
          amount={totalGroups}
          tone="neutral"
          icon={Layers}
          isMoney={false}
          note="Active groups you belong to"
        />
        <MetricCard
          label="TOTAL MEMBERS"
          amount={uniqueMembersCount}
          tone="neutral"
          icon={Users}
          isMoney={false}
          note={`Unique people across your groups (${totalGroupMemberships} memberships)`}
        />
        <MetricCard
          label="GROUP SPENDING"
          amount={totalGroupExpenses}
          tone="warning"
          icon={ReceiptText}
          currency={currency}
          isMoney={true}
          note="Combined spend across your groups"
        />
        <MetricCard
          label="PENDING SETTLEMENTS"
          amount={pendingSettlements.length}
          tone={pendingSettlements.length ? 'negative' : 'positive'}
          icon={Handshake}
          isMoney={false}
          note={`${pendingSettlements.length} awaiting confirmation`}
        />
      </section>

      {/* Filter and Search Bar */}
      <div className="list-toolbar groups-toolbar">
        <label className="search">
          <Search size={18} />
          <span className="sr-only">Search groups</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups by name or description…"
          />
        </label>

        <label>
          <span className="sr-only">Filter by Category</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {groupCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Groups Grid */}
      {filteredGroups.length > 0 ? (
        <div className="group-grid">
          {filteredGroups.map((group) => {
            const groupExp = data.expenses.filter((e) => e.groupId === group.id);
            const total = expenseTotal(groupExp);
            const groupBalances = calculateBalances(groupExp);
            const myBalance = groupBalances[data.user.id] || 0;

            return (
              <article className="group-card-wrap" key={group.id}>
                <div className="group-card-outer">
                  <button
                    type="button"
                    className="group-card"
                    onClick={() => navigate(`/groups/${group.id}`)}
                  >
                    <div className="group-card-head">
                      <span className="group-emoji">{group.emoji || '✦'}</span>
                      <span className="badge soft">{group.category}</span>
                    </div>

                    <h3>{group.name}</h3>
                    {group.description && <p className="group-desc-preview">{group.description}</p>}

                    <div className="group-card-stats-row">
                      <div className="avatar-stack">
                        {group.members.slice(0, 5).map((id) => (
                          <Avatar key={id} member={getMember(data, id)} small />
                        ))}
                        {group.members.length > 5 && (
                          <span className="avatar-overflow">+{group.members.length - 5}</span>
                        )}
                      </div>
                      <span className="group-member-count">{group.members.length} members</span>
                    </div>

                    <footer>
                      <div>
                        <small>Total Spent</small>
                        <b>{formatMoney(total, currency)}</b>
                      </div>
                      <div className="balance-badge-wrap">
                        <small>Your Balance</small>
                        <span className={`status-pill ${myBalance > 0 ? 'positive' : myBalance < 0 ? 'negative' : 'neutral'}`}>
                          {myBalance > 0 ? `+${formatMoney(myBalance, currency)}`
                            : myBalance < 0 ? formatMoney(myBalance, currency)
                            : 'Settled'}
                        </span>
                      </div>
                    </footer>
                  </button>

                  <div className="group-card-footer-actions">
                    <button
                      type="button"
                      className="button primary small open-group-btn"
                      onClick={() => navigate(`/groups/${group.id}`)}
                    >
                      Open Group →
                    </button>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => setEditing(group)}
                      title="Edit group name or settings"
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="button ghost small delete-btn"
                      onClick={() => removeGroup(group)}
                      title="Delete this group"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={data.groups.length ? 'No matching groups found' : 'You haven’t joined any groups yet'}
          text={
            data.groups.length
              ? 'Try adjusting your search query or category filter.'
              : 'Create your first group to start sharing expenses and tracking balances with your friends.'
          }
          action={
            <button className="button primary" onClick={() => setEditing({})}>
              <Plus size={16} /> Create Group
            </button>
          }
        />
      )}

      {/* Create / Edit Group Modal */}
      {editing && (
        <Modal
          title={editing.id ? 'Edit Group' : 'Create a New Group'}
          onClose={() => { setEditing(null); setError(''); }}
        >
          <form className="form-grid" onSubmit={saveGroup} noValidate>
            <label className="full">
              Group Name *
              <input
                name="name"
                required
                defaultValue={editing.name || ''}
                maxLength="60"
                placeholder="e.g. Goa Escape, Maple House, Trip to Japan"
              />
            </label>

            <label>
              Category
              <select name="category" defaultValue={editing.category || 'Travel'}>
                {groupCategories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Emoji Icon
              <select name="emoji" defaultValue={editing.emoji || '🌊'}>
                {['🌊', '🏠', '✨', '✈️', '🍕', '🍻', '🎓', '💼', '🏕️', '🚗', '🛍️'].map((em) => (
                  <option key={em} value={em}>{em}</option>
                ))}
              </select>
            </label>

            <label className="full">
              Description (Optional)
              <input
                name="description"
                defaultValue={editing.description || ''}
                maxLength="120"
                placeholder="Brief summary of what this group is for"
              />
            </label>

            <fieldset className="participant-picker full">
              <legend>Select Existing Members</legend>
              <p className="field-hint">You are automatically included as the group creator.</p>
              <div className="participant-options">
                {(data.members || []).map((person) => (
                  <label key={person.id} className="participant-badge">
                    <input
                      type="checkbox"
                      name="members"
                      value={person.id}
                      defaultChecked={
                        editing.members
                          ? editing.members.includes(person.id)
                          : person.id === data.user.id || person.id === 'maya'
                      }
                    />
                    <span>{person.name} {person.id === data.user.id ? '(You)' : ''}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {!editing.id && (
              <div className="inline-add-member full">
                <p className="field-label"><strong>Or invite someone new to this group:</strong></p>
                <div className="inline-inputs">
                  <input
                    name="newMemberName"
                    placeholder="Friend's full name"
                    maxLength="50"
                  />
                  <input
                    name="newMemberEmail"
                    type="email"
                    placeholder="friend@example.com"
                  />
                </div>
                <small className="security-note">
                  Simulated Invitations: SplitSpace runs entirely in the browser. When you add a member, their account is simulated locally and added to the group immediately.
                </small>
              </div>
            )}

            {error && <p className="form-error full" role="alert">{error}</p>}

            <div className="modal-actions full">
              <button
                type="button"
                className="button ghost"
                onClick={() => { setEditing(null); setError(''); }}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                {editing.id ? 'Save group' : 'Create group'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. GROUP DETAIL PAGE (Phase 5)
// ---------------------------------------------------------------------------
export function GroupDetail({
  data,
  setData,
  addExpense,
  updateExpense,
  onDelete,
  settle,
  confirmSettlement,
  cancelSettlement
}) {
  const { id } = useParams();
  const group = data.groups.find((item) => item.id === id);
  const currency = data.settings?.currency || 'INR';

  const [activeTab, setActiveTab] = useState('overview'); // overview, members, expenses, balances, settlements, activity
  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settleModal, setSettleModal] = useState(false);
  const [settleToUser, setSettleToUser] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [newInviteName, setNewInviteName] = useState('');
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [selectedReceiptExpense, setSelectedReceiptExpense] = useState(null);

  // Filters for expenses tab
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('all');
  const [expenseSort, setExpenseSort] = useState('newest'); // newest, oldest, amount_desc, amount_asc

  if (!group) {
    return (
      <div className="page-content empty">
        <EmptyState
          title="Group Not Found"
          text="The group you are looking for does not exist or has been removed."
          action={
            <Link className="button primary" to="/groups">
              Back to Groups
            </Link>
          }
        />
      </div>
    );
  }

  const groupExpenses = data.expenses
    .filter((e) => e.groupId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalSpent = expenseTotal(groupExpenses);
  const groupBalances = calculateBalances(groupExpenses);
  const userBalance = groupBalances[data.user.id] || 0;
  const userShare = groupExpenses.reduce(
    (sum, exp) => sum + (exp.shares?.[data.user.id] || 0),
    0
  );

  const groupSettlements = (data.settlements || []).filter(
    (s) => group.members.includes(s.from) && group.members.includes(s.to)
  );

  const groupDebts = simplifyDebts(groupBalances);

  // Group candidate members not yet added
  const candidates = (data.members || []).filter((person) => !group.members.includes(person.id));

  const inviteExisting = (memberId) => {
    if (!memberId) return;
    setData((old) => addGroupMember(old, id, memberId, createId(), today()));
    setInviteOpen(false);
  };

  const inviteNewPerson = (e) => {
    e.preventDefault();
    if (!newInviteName.trim()) return;

    // Check duplicate email or name
    const existing = (data.members || []).find(
      (m) =>
        m.name.toLowerCase() === newInviteName.trim().toLowerCase() ||
        (newInviteEmail.trim() && m.email?.toLowerCase() === newInviteEmail.trim().toLowerCase())
    );
    if (existing && group.members.includes(existing.id)) {
      alert(`${existing.name} is already a member of this group.`);
      return;
    }

    const newId = existing ? existing.id : `member-${createId().slice(0, 8)}`;
    if (!existing) {
      const initials = newInviteName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
      const newPerson = {
        id: newId,
        name: newInviteName.trim(),
        email: newInviteEmail.trim() || `${newId}@splitspace.demo`,
        initials: initials || 'NM',
        color: palette[(data.members?.length || 0) % palette.length],
        role: 'user',
        status: 'active',
        registeredAt: today()
      };
      setData((old) => {
        const withNewMember = addMemberDirectory(old, newPerson);
        return addGroupMember(withNewMember, id, newId, createId(), today());
      });
    } else {
      setData((old) => addGroupMember(old, id, existing.id, createId(), today()));
    }

    setNewInviteName('');
    setNewInviteEmail('');
    setInviteOpen(false);
  };

  const removeMember = (memberId) => {
    if (memberId === data.user.id) {
      alert('You cannot remove yourself from this group.');
      return;
    }
    const person = getMember(data, memberId);
    if (!window.confirm(`Remove ${person.name} from "${group.name}"?`)) return;

    setData((old) => removeGroupMember(old, id, memberId));
  };

  const openExpense = (expense = null) => {
    setEditingExpense(expense);
    setExpenseModal(true);
  };

  const removeExpense = (expense) => {
    if (window.confirm(`Delete “${expense.description}”? This will recalculate group balances.`)) {
      onDelete(expense.id);
    }
  };

  const openSettleModal = (toMemberId = '', suggestedAmount = null) => {
    setSettleToUser(toMemberId);
    if (suggestedAmount) {
      setSettleAmount(fromPaise(suggestedAmount));
    } else {
      setSettleAmount('');
    }
    setSettleNote('Direct payment in ' + group.name);
    setSettleModal(true);
  };

  const handleRecordSettlement = (e) => {
    e.preventDefault();
    if (!settleToUser) {
      alert('Please select a recipient to settle with.');
      return;
    }
    const amountVal = parseFloat(settleAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Please enter a valid settlement amount.');
      return;
    }
    const debtPayload = {
      from: data.user.id,
      to: settleToUser,
      amount: toPaise(amountVal),
      note: settleNote.trim() || `Settlement in ${group.name}`
    };
    if (settle) {
      settle(debtPayload);
    } else {
      setData((old) => ({
        ...old,
        settlements: [
          {
            id: createId(),
            ...debtPayload,
            status: 'pending',
            date: today()
          },
          ...(old.settlements || [])
        ]
      }));
    }
    setSettleModal(false);
  };

  // Group activity timeline
  const groupActivity = [
    ...groupExpenses.map((e) => ({
      id: e.id,
      date: e.date,
      type: 'expense',
      title: `${getMember(data, e.paidBy).name} added "${e.description}"`,
      detail: `${formatMoney(e.amount, currency)} · ${e.category}`
    })),
    ...groupSettlements.map((s) => ({
      id: `s-${s.id}`,
      date: s.confirmedAt || s.date,
      type: 'settlement',
      title: `${getMember(data, s.from).name} → ${getMember(data, s.to).name} payment ${s.status}`,
      detail: formatMoney(s.amount, currency)
    }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  // Filtered and sorted group expenses for Expenses tab
  const filteredGroupExpenses = groupExpenses.filter((e) => {
    const matchesSearch =
      !expenseSearch.trim() ||
      e.description.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      getMember(data, e.paidBy).name.toLowerCase().includes(expenseSearch.toLowerCase());
    const matchesCat = expenseCategory === 'all' || e.category === expenseCategory;
    return matchesSearch && matchesCat;
  }).sort((a, b) => {
    if (expenseSort === 'oldest') return a.date.localeCompare(b.date);
    if (expenseSort === 'amount_desc') return b.amount - a.amount;
    if (expenseSort === 'amount_asc') return a.amount - b.amount;
    return b.date.localeCompare(a.date); // newest
  });

  return (
    <div className="page-content group-detail-page">
      <Link className="back-link" to="/groups">
        ← Back to all groups
      </Link>

      {/* Group Hero Section */}
      <section className="group-hero-card">
        <div className="group-hero-left">
          <span className="group-hero-emoji">{group.emoji || '✦'}</span>
          <div>
            <div className="group-badges-row">
              <span className="badge soft">{group.category}</span>
              <span className="badge neutral">Created {group.createdAt || 'Nov 2026'}</span>
            </div>
            <h2>{group.name}</h2>
            {group.description && <p className="group-hero-desc">{group.description}</p>}
          </div>
        </div>
        <div className="group-hero-actions">
          <button className="button ghost" onClick={() => setInviteOpen(true)}>
            <UserPlus size={16} /> Invite member
          </button>
          <button className="button ghost" onClick={() => openSettleModal()}>
            <Handshake size={16} /> Settle up
          </button>
          <button className="button primary" onClick={() => openExpense()}>
            <Plus size={16} /> Add expense
          </button>
        </div>
      </section>

      {/* Group Key Summary Banner */}
      <section className="summary-banner" aria-label="Group summary">
        <div>
          <small>TOTAL GROUP SPENDING</small>
          <b>{formatMoney(totalSpent, currency)}</b>
        </div>
        <div>
          <small>YOUR SHARE</small>
          <b>{formatMoney(userShare, currency)}</b>
        </div>
        <div>
          <small>YOUR GROUP BALANCE</small>
          <b className={userBalance > 0 ? 'green-text' : userBalance < 0 ? 'red-text' : ''}>
            {userBalance > 0 ? `+${formatMoney(userBalance, currency)}`
              : userBalance < 0 ? formatMoney(userBalance, currency)
              : 'All settled'}
          </b>
        </div>
        <div>
          <small>ACTIVE MEMBERS</small>
          <b>{group.members.length}</b>
        </div>
      </section>

      {/* 6 Tabs Navigation Bar */}
      <div className="tabs-nav" role="tablist" style={{ marginBottom: '20px' }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'members', label: `Members (${group.members.length})` },
          { key: 'expenses', label: `Expenses (${groupExpenses.length})` },
          { key: 'balances', label: `Balances (${groupDebts.length})` },
          { key: 'settlements', label: `Settlements (${groupSettlements.length})` },
          { key: 'activity', label: 'Activity' }
        ].map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            className={`tab-btn ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="tab-pane-overview">
          <section className="two-col">
            <article className="panel">
              <header>
                <div>
                  <p className="eyebrow">PEOPLE & BALANCES</p>
                  <h3>Quick member list</h3>
                </div>
                <button className="button primary small" onClick={() => setInviteOpen(true)}>
                  Invite member
                </button>
              </header>
              <div className="quick-member-list">
                {group.members.map((memberId) => {
                  const m = getMember(data, memberId);
                  const bal = groupBalances[memberId] || 0;
                  return (
                    <div className="person-balance" key={memberId}>
                      <Avatar member={m} small />
                      <span style={{ flex: 1, marginLeft: '4px' }}>
                        {m.name}
                        {memberId === data.user.id ? ' · You' : ''}
                      </span>
                      <b className={bal >= 0 ? 'green-text' : 'red-text'}>
                        {bal >= 0 ? '+' : ''}
                        {formatMoney(bal, currency)}
                      </b>
                      {memberId !== data.user.id && (
                        <button
                          className="row-action"
                          aria-label={`Remove ${m.name}`}
                          onClick={() => removeMember(memberId)}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <footer style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', textAlign: 'right' }}>
                <button
                  type="button"
                  className="plain-button"
                  onClick={() => setActiveTab('members')}
                >
                  View full member directory ({group.members.length}) →
                </button>
              </footer>
            </article>

            <article className="panel">
              <header>
                <div>
                  <p className="eyebrow">GROUP SETTLEMENT STATUS</p>
                  <h3>Simplified debts</h3>
                </div>
                <button className="button ghost small" onClick={() => openSettleModal()}>
                  <Handshake size={14} /> Settle up
                </button>
              </header>
              <div className="group-debts-list" style={{ padding: '8px 20px' }}>
                {groupDebts.length ? (
                  groupDebts.map((debt, idx) => {
                    const fromM = getMember(data, debt.from);
                    const toM = getMember(data, debt.to);
                    const isYouPayer = debt.from === data.user.id;
                    const isYouReceiver = debt.to === data.user.id;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 0',
                          borderBottom: idx < groupDebts.length - 1 ? '1px solid var(--line)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar member={fromM} small />
                          <span><b>{isYouPayer ? 'You' : fromM.name}</b> owes <b>{isYouReceiver ? 'You' : toM.name}</b></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <b className={isYouPayer ? 'red-text' : isYouReceiver ? 'green-text' : ''}>
                            {formatMoney(debt.amount, currency)}
                          </b>
                          {isYouPayer && (
                            <button
                              type="button"
                              className="button primary small"
                              onClick={() => openSettleModal(debt.to, debt.amount)}
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="panel-empty" style={{ padding: '24px 0' }}>
                    Everyone in this group is all settled up!
                  </p>
                )}
              </div>
            </article>
          </section>

          {/* Recent Expenses under Overview */}
          <article className="panel recent-panel" style={{ marginTop: '20px' }}>
            <header>
              <div>
                <p className="eyebrow">RECENT ACTIVITY</p>
                <h3>Recent group expenses</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="plain-button" onClick={() => setActiveTab('expenses')}>
                  View all ({groupExpenses.length}) →
                </button>
                <button className="button primary small" onClick={() => openExpense()}>
                  <Plus size={15} /> Add expense
                </button>
              </div>
            </header>
            {groupExpenses.slice(0, 5).map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                data={data}
                onEdit={openExpense}
                onDelete={removeExpense}
                onViewReceipt={(e) => setSelectedReceiptExpense(e)}
              />
            ))}
            {!groupExpenses.length && (
              <EmptyState
                title="No expenses yet"
                text="Add the first expense for this group."
                action={
                  <button className="button primary small" onClick={() => openExpense()}>
                    <Plus size={14} /> Add expense
                  </button>
                }
              />
            )}
          </article>
        </div>
      )}

      {/* 2. MEMBERS TAB */}
      {activeTab === 'members' && (
        <div className="tab-pane-members">
          <article className="panel">
            <header>
              <div>
                <p className="eyebrow">DIRECTORY & FINANCIAL LEDGER</p>
                <h3>Group Members ({group.members.length})</h3>
              </div>
              <button className="button primary small" onClick={() => setInviteOpen(true)}>
                <UserPlus size={15} /> Invite member
              </button>
            </header>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Group Role</th>
                    <th>Status</th>
                    <th>Amount Paid Upfront</th>
                    <th>Personal Share</th>
                    <th>Net Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((memberId) => {
                    const person = getMember(data, memberId);
                    const amountPaid = groupExpenses
                      .filter((e) => e.paidBy === memberId)
                      .reduce((sum, e) => sum + e.amount, 0);
                    const personalShare = groupExpenses.reduce(
                      (sum, e) => sum + (e.shares?.[memberId] || 0),
                      0
                    );
                    const netBal = groupBalances[memberId] || 0;
                    const isCreator = group.createdBy === memberId;
                    const roleLabel = isCreator ? 'Admin' : person.role === 'admin' ? 'Admin' : 'Member';

                    return (
                      <tr key={memberId}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar member={person} />
                            <div>
                              <b>{person.name}</b>
                              {memberId === data.user.id && <span className="badge soft" style={{ marginLeft: '6px' }}>You</span>}
                              <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px' }}>
                                {person.email}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${roleLabel === 'Admin' ? 'active' : 'neutral'}`}>
                            {roleLabel}
                          </span>
                        </td>
                        <td>
                          <span className="status-pill active">
                            Active
                          </span>
                        </td>
                        <td>
                          <b>{formatMoney(amountPaid, currency)}</b>
                        </td>
                        <td>
                          <span>{formatMoney(personalShare, currency)}</span>
                        </td>
                        <td>
                          <b className={netBal > 0 ? 'green-text' : netBal < 0 ? 'red-text' : ''}>
                            {netBal > 0 ? `+${formatMoney(netBal, currency)}` : netBal < 0 ? formatMoney(netBal, currency) : 'All settled'}
                          </b>
                        </td>
                        <td>
                          {memberId !== data.user.id ? (
                            <button
                              className="button danger small"
                              aria-label={`Remove ${person.name}`}
                              onClick={() => removeMember(memberId)}
                              title="Remove member from this group"
                            >
                              <X size={14} /> Remove
                            </button>
                          ) : (
                            <span style={{ color: 'var(--faint)', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '16px 20px', background: 'var(--panel-2)', borderTop: '1px solid var(--line)', fontSize: '12px', color: 'var(--muted)', display: 'grid', gap: '4px' }}>
              <div>• <b>Amount Paid Upfront</b>: Total actual money paid by this member across all group expenses.</div>
              <div>• <b>Personal Share</b>: Calculated portion of group expenses belonging to this member.</div>
              <div>• <b>Net Balance</b>: Amount Paid minus Personal Share, adjusted for peer settlements.</div>
            </div>
          </article>
        </div>
      )}

      {/* 3. EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div className="tab-pane-expenses">
          <article className="panel">
            <header>
              <div>
                <p className="eyebrow">GROUP LEDGER</p>
                <h3>Expenses ({filteredGroupExpenses.length})</h3>
              </div>
              <button className="button primary small" onClick={() => openExpense()}>
                <Plus size={15} /> Add expense
              </button>
            </header>

            <div className="list-toolbar" style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  type="search"
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="Search group expenses..."
                  style={{ paddingLeft: '32px', width: '100%' }}
                />
              </div>
              <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select value={expenseSort} onChange={(e) => setExpenseSort(e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount_desc">Highest amount</option>
                <option value="amount_asc">Lowest amount</option>
              </select>
            </div>

            {filteredGroupExpenses.length ? (
              filteredGroupExpenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  data={data}
                  onEdit={openExpense}
                  onDelete={removeExpense}
                  onViewReceipt={(e) => setSelectedReceiptExpense(e)}
                />
              ))
            ) : (
              <EmptyState
                title="No expenses found"
                text={groupExpenses.length ? 'No expenses match your search or filter criteria.' : 'No expenses have been added to this group yet.'}
                action={
                  groupExpenses.length ? (
                    <button className="button ghost small" onClick={() => { setExpenseSearch(''); setExpenseCategory('all'); }}>
                      Clear filters
                    </button>
                  ) : (
                    <button className="button primary small" onClick={() => openExpense()}>
                      <Plus size={14} /> Add expense
                    </button>
                  )
                }
              />
            )}
          </article>
        </div>
      )}

      {/* 4. BALANCES TAB */}
      {activeTab === 'balances' && (
        <div className="tab-pane-balances">
          <article className="panel">
            <header>
              <div>
                <p className="eyebrow">OPTIMIZED SETTLEMENT GRAPH</p>
                <h3>Who Owes Whom in {group.name}</h3>
              </div>
              <button className="button primary small" onClick={() => openSettleModal()}>
                <Handshake size={15} /> Settle Up
              </button>
            </header>

            <div style={{ padding: '20px' }}>
              {groupDebts.length ? (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {groupDebts.map((debt, idx) => {
                    const fromM = getMember(data, debt.from);
                    const toM = getMember(data, debt.to);
                    const isYouPayer = debt.from === data.user.id;
                    const isYouReceiver = debt.to === data.user.id;

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 20px',
                          border: '1px solid var(--line)',
                          borderRadius: '10px',
                          background: 'var(--panel-2)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <Avatar member={fromM} />
                          <div>
                            <b>{isYouPayer ? 'You' : fromM.name}</b>
                            <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px' }}>
                              Debtor (owes money)
                            </small>
                          </div>
                          <span style={{ color: 'var(--faint)', fontSize: '18px' }}>→</span>
                          <Avatar member={toM} />
                          <div>
                            <b>{isYouReceiver ? 'You' : toM.name}</b>
                            <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px' }}>
                              Creditor (is owed money)
                            </small>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px' }}>AMOUNT</small>
                            <b className={isYouPayer ? 'red-text' : isYouReceiver ? 'green-text' : ''} style={{ fontSize: '16px' }}>
                              {formatMoney(debt.amount, currency)}
                            </b>
                          </div>
                          {isYouPayer ? (
                            <button
                              type="button"
                              className="button primary small"
                              onClick={() => openSettleModal(debt.to, debt.amount)}
                            >
                              Settle Now
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="button ghost small"
                              onClick={() => openSettleModal(debt.to, debt.amount)}
                            >
                              Record Payment
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="All Settled Up!"
                  text="There are no outstanding debts between members in this group."
                  icon={CheckCircle2}
                />
              )}
            </div>

            <p className="security-note" style={{ margin: '0 20px 20px' }}>
              Integer Paise Debt Simplification: SplitSpace computes minimal pairwise cash transfers across all group transactions using exact integer arithmetic to minimize total payments needed to settle balances.
            </p>
          </article>
        </div>
      )}

      {/* 5. SETTLEMENTS TAB */}
      {activeTab === 'settlements' && (
        <div className="tab-pane-settlements">
          <article className="panel">
            <header>
              <div>
                <p className="eyebrow">GROUP PAYMENT AUDIT</p>
                <h3>Settlement History ({groupSettlements.length})</h3>
              </div>
              <button className="button primary small" onClick={() => openSettleModal()}>
                <Handshake size={15} /> Record Payment
              </button>
            </header>

            {groupSettlements.length ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Payer</th>
                      <th>Recipient</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Note</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupSettlements.map((item) => {
                      const fromM = getMember(data, item.from);
                      const toM = getMember(data, item.to);
                      const canConfirm = item.status === 'pending' && (item.to === data.user.id || data.user.role === 'admin');

                      return (
                        <tr key={item.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Avatar member={fromM} small />
                              <span>{fromM.name}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Avatar member={toM} small />
                              <span>{toM.name}</span>
                            </div>
                          </td>
                          <td><b>{formatMoney(item.amount, currency)}</b></td>
                          <td>
                            <span className={`status-pill ${item.status === 'settled' ? 'active' : item.status === 'pending' ? 'pending' : 'neutral'}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>{item.date}</td>
                          <td>{item.note || '—'}</td>
                          <td>
                            {canConfirm && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {confirmSettlement && (
                                  <button
                                    type="button"
                                    className="button primary small"
                                    onClick={() => confirmSettlement(item.id)}
                                  >
                                    Confirm payment
                                  </button>
                                )}
                                {cancelSettlement && (
                                  <button
                                    type="button"
                                    className="button ghost small"
                                    onClick={() => cancelSettlement(item.id)}
                                  >
                                    Reject
                                  </button>
                                )}
                              </div>
                            )}
                            {item.status === 'pending' && !canConfirm && (
                              <small style={{ color: 'var(--muted)' }}>Awaiting receipt</small>
                            )}
                            {item.status === 'settled' && (
                              <span style={{ color: 'var(--green)', fontSize: '12px' }}>✓ Confirmed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No settlements recorded"
                text="When members settle debts in this group, their payment records will appear here."
                icon={Handshake}
                action={
                  <button className="button primary small" onClick={() => openSettleModal()}>
                    <Handshake size={14} /> Record Payment
                  </button>
                }
              />
            )}
          </article>
        </div>
      )}

      {/* 6. ACTIVITY TAB */}
      {activeTab === 'activity' && (
        <div className="tab-pane-activity">
          <article className="panel">
            <header>
              <div>
                <p className="eyebrow">AUDIT STREAM</p>
                <h3>Group Activity History</h3>
              </div>
            </header>
            <div style={{ padding: '10px 0' }}>
              {groupActivity.map((entry) => (
                <div className="activity-entry" key={entry.id} style={{ display: 'flex', gap: '14px', padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-soft)', color: '#bda6ff' }}>
                    <Activity size={16} />
                  </span>
                  <div>
                    <b>{entry.title}</b>
                    <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px', marginTop: '3px' }}>
                      {entry.date} · {entry.detail}
                    </small>
                  </div>
                </div>
              ))}
              {!groupActivity.length && (
                <p className="panel-empty">No activity recorded for this group yet.</p>
              )}
            </div>
          </article>
        </div>
      )}

      {/* Settle Up Modal */}
      {settleModal && (
        <Modal title={`Settle Up in ${group.name}`} onClose={() => setSettleModal(false)}>
          <form onSubmit={handleRecordSettlement} className="form-grid">
            <label className="full">
              Recipient (Who are you paying?)
              <select
                required
                value={settleToUser}
                onChange={(e) => setSettleToUser(e.target.value)}
              >
                <option value="">Select a member...</option>
                {group.members
                  .filter((mId) => mId !== data.user.id)
                  .map((mId) => {
                    const person = getMember(data, mId);
                    const debtToPerson = groupDebts.find((d) => d.from === data.user.id && d.to === mId);
                    return (
                      <option key={mId} value={mId}>
                        {person.name} {debtToPerson ? `(You owe ${formatMoney(debtToPerson.amount, currency)})` : ''}
                      </option>
                    );
                  })}
              </select>
            </label>

            <label className="full">
              Amount ({currency})
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
              />
            </label>

            <label className="full">
              Payment Note
              <input
                type="text"
                maxLength="80"
                placeholder="e.g. UPI transfer, Cash, Bank"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />
            </label>

            <div className="security-note full" style={{ padding: '8px 0' }}>
              Notice: SplitSpace is a simulated fintech demo. No real banking or payment rails are connected. Recording this creates a pending settlement for confirmation.
            </div>

            <div className="modal-actions full">
              <button type="button" className="button ghost" onClick={() => setSettleModal(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit">
                Record Payment
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Invite Member Modal */}
      {inviteOpen && (
        <Modal title={`Add someone to ${group.name}`} onClose={() => setInviteOpen(false)}>
          <div className="invite-modal-content">
            <h4>Select from Directory:</h4>
            {candidates.length ? (
              <div className="invite-list">
                {candidates.map((person) => (
                  <div className="person-balance" key={person.id}>
                    <Avatar member={person} small />
                    <div>
                      <strong>{person.name}</strong>
                      <small className="muted-text">{person.email}</small>
                    </div>
                    <button
                      type="button"
                      className="button primary small"
                      onClick={() => inviteExisting(person.id)}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-empty">All directory users are already members of this group.</p>
            )}

            <div className="invite-divider">
              <span>Or invite a new person</span>
            </div>

            <form onSubmit={inviteNewPerson} className="inline-invite-form">
              <label>
                Full Name
                <input
                  required
                  value={newInviteName}
                  onChange={(e) => setNewInviteName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                />
              </label>
              <label>
                Email Address
                <input
                  type="email"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  placeholder="priya@example.com"
                />
              </label>
              <button className="button primary" type="submit">
                Invite Person
              </button>
            </form>

            <p className="security-note">
              Simulated Invitations: SplitSpace runs on the frontend. When you invite someone, their profile is simulated in Local Storage and added directly to this group.
            </p>
          </div>
        </Modal>
      )}

      {/* Expense Modal */}
      {expenseModal && (
        <Modal
          title={editingExpense ? 'Edit expense' : 'Add an expense'}
          onClose={() => setExpenseModal(false)}
        >
          <ExpenseForm
            groups={[group]}
            members={data.members || []}
            initial={editingExpense}
            storedReceiptBytes={getStoredReceiptBytes(data.expenses, editingExpense?.id)}
            currency={currency}
            onClose={() => setExpenseModal(false)}
            onSave={(expense) => {
              (editingExpense ? updateExpense : addExpense)(expense);
              setExpenseModal(false);
            }}
          />
        </Modal>
      )}

      {/* Receipt Modal */}
      {selectedReceiptExpense && selectedReceiptExpense.receipt && (
        <Modal
          title={`Receipt: ${selectedReceiptExpense.description}`}
          onClose={() => setSelectedReceiptExpense(null)}
        >
          <div className="receipt-view-modal">
            {selectedReceiptExpense.receipt.type === 'application/pdf' ? (
              <object
                data={selectedReceiptExpense.receipt.dataUrl}
                type="application/pdf"
                className="receipt-modal-object"
              >
                <p>PDF preview unavailable. <a href={selectedReceiptExpense.receipt.dataUrl} download={selectedReceiptExpense.receipt.name}>Download</a></p>
              </object>
            ) : (
              <img
                src={selectedReceiptExpense.receipt.dataUrl}
                alt="Receipt"
                className="receipt-modal-image"
              />
            )}
            <div className="modal-actions">
              <button className="button primary" onClick={() => setSelectedReceiptExpense(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. EXPENSES PAGE (Phase 6)
// ---------------------------------------------------------------------------
export function ExpensesPage({
  data,
  addExpense,
  updateExpense,
  onDelete,
  runRecurring,
  updateRecurring,
  toggleRecurring,
  deleteRecurring
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [groupId, setGroupId] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, this-month, last-month
  const [sort, setSort] = useState('date-desc');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [forceRecurring, setForceRecurring] = useState(false);
  const [receiptViewExpense, setReceiptViewExpense] = useState(null);
  const currency = data.settings?.currency || 'INR';

  // Date filtering logic
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const filtered = filterAndSortExpenses(data.expenses, {
    query,
    category,
    groupId,
    sort,
    memberName: (memberId) => getMember(data, memberId).name
  }).filter((expense) => {
    if (dateFilter === 'this-month') return expense.date?.startsWith(currentMonthKey);
    if (dateFilter === 'last-month') return expense.date?.startsWith(lastMonthKey);
    return true;
  });

  // Calculate top stats
  const totalExpensesCount = data.expenses.length;
  const totalExpensesAmount = expenseTotal(data.expenses);
  const thisMonthExpenses = data.expenses.filter((e) => e.date?.startsWith(currentMonthKey));
  const thisMonthAmount = expenseTotal(thisMonthExpenses);

  const yourPaidAmount = data.expenses
    .filter((e) => e.paidBy === data.user.id)
    .reduce((sum, e) => sum + e.amount, 0);

  const yourTotalShare = data.expenses.reduce(
    (sum, e) => sum + (e.shares?.[data.user.id] || 0),
    0
  );

  const remove = (expense) => {
    if (window.confirm(`Delete “${expense.description}”? This will recalculate balances.`)) {
      onDelete(expense.id);
    }
  };

  const exportData = () => {
    downloadCsv('splitspace-expenses.csv', [
      ['Description', 'Group', 'Category', 'Paid by', 'Date', 'Amount INR', 'Your share INR', 'Source', 'Recurrence period', 'Receipt'],
      ...filtered.map((expense) => [
        expense.description,
        data.groups.find((group) => group.id === expense.groupId)?.name || '',
        expense.category,
        getMember(data, expense.paidBy).name,
        expense.date,
        fromPaise(expense.amount),
        fromPaise(expense.shares?.[data.user.id] || 0),
        expense.generatedFrom || 'manual',
        expense.recurrencePeriod || '',
        expense.receipt?.name || ''
      ])
    ]);
  };

  const openEdit = (expense) => {
    setSelected(expense);
    setModal(true);
  };

  const openSchedule = (schedule = null) => {
    setSelected(null);
    setSelectedSchedule(schedule);
    setForceRecurring(true);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setSelected(null);
    setSelectedSchedule(null);
    setForceRecurring(false);
  };

  const saveForm = (value) => {
    if (value.schedule) {
      updateRecurring(value.schedule);
    } else {
      (selected ? updateExpense : addExpense)(value);
    }
    closeModal();
  };

  const removeSchedule = (schedule) => {
    if (window.confirm(`Remove the ${schedule.interval} schedule for “${schedule.description}”? Generated expenses will remain in the ledger.`)) {
      deleteRecurring(schedule.id);
    }
  };

  return (
    <div className="page-content">
      {/* Top Header */}
      <div className="page-intro">
        <div>
          <p className="eyebrow">TRANSACTIONS LEDGER</p>
          <h2>Expenses Management</h2>
          <p>Search, filter, categorize and audit every shared transaction.</p>
        </div>
        <div className="page-actions">
          <button className="button ghost" onClick={() => openSchedule()}>
            <RefreshCw size={15} /> Schedule expense
          </button>
          <button
            className="button primary"
            onClick={() => {
              setSelected(null);
              setSelectedSchedule(null);
              setForceRecurring(false);
              setModal(true);
            }}
          >
            <Plus size={16} /> Add expense
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <section className="metrics" aria-label="Expenses summary metrics">
        <MetricCard
          label="TOTAL EXPENSES"
          amount={totalExpensesAmount}
          tone="neutral"
          icon={ReceiptText}
          currency={currency}
          note={`${totalExpensesCount} recorded ${totalExpensesCount === 1 ? 'expense' : 'expenses'}`}
        />
        <MetricCard
          label="THIS MONTH"
          amount={thisMonthAmount}
          tone="warning"
          icon={Calendar}
          currency={currency}
          note={`${thisMonthExpenses.length} transactions in ${now.toLocaleDateString('en-IN', { month: 'short' })}`}
        />
        <MetricCard
          label="YOUR PAID AMOUNT"
          amount={yourPaidAmount}
          tone="positive"
          icon={Wallet}
          currency={currency}
          note="Fronted by you across all groups"
        />
        <MetricCard
          label="YOUR TOTAL SHARE"
          amount={yourTotalShare}
          tone="neutral"
          icon={CheckCircle2}
          currency={currency}
          note="Your net allocated consumption"
        />
      </section>

      {/* Search and Filters Toolbar */}
      <div className="list-toolbar">
        <label className="search">
          <Search size={18} />
          <span className="sr-only">Search expenses</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description, category, payer"
          />
        </label>

        <label>
          <span className="sr-only">Filter category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Filter group</span>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="all">All groups</option>
            {data.groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Sort expenses</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </label>

        <label>
          <span className="sr-only">Filter by date</span>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="all">All Time</option>
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
          </select>
        </label>

        <button className="button ghost" onClick={exportData} title="Download filtered expenses as CSV">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Expenses Table / List */}
      <article className="panel expense-list">
        <header>
          <span>EXPENSE</span>
          <span>PAID</span>
          <span>YOUR SHARE</span>
          <span>ACTIONS</span>
        </header>

        {filtered.length ? (
          filtered.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              data={data}
              onEdit={openEdit}
              onDelete={remove}
              onViewReceipt={(e) => setReceiptViewExpense(e)}
            />
          ))
        ) : (
          <EmptyState
            title="No matching expenses"
            text={data.expenses.length ? 'Adjust your search or filters to see records.' : 'Add a shared expense to start your ledger.'}
            action={
              <button
                className="button primary small"
                onClick={() => {
                  setSelected(null);
                  setSelectedSchedule(null);
                  setForceRecurring(false);
                  setModal(true);
                }}
              >
                <Plus size={14} /> Add an expense
              </button>
            }
          />
        )}
      </article>

      {/* Recurring Schedules Section */}
      <section className="panel recurring-panel">
        <header>
          <div>
            <p className="eyebrow">AUTOMATION</p>
            <h3>Recurring Expense Schedules</h3>
          </div>
          <button className="button ghost small" onClick={runRecurring}>
            <RefreshCw size={13} /> Check due schedules
          </button>
        </header>

        {data.recurringExpenses?.length ? (
          data.recurringExpenses.map((schedule) => (
            <div className="recurring-row" key={schedule.id}>
              <div className="recurring-mark" aria-hidden="true">↻</div>
              <div className="recurring-info">
                <b>
                  {schedule.description} <span className="source-badge">Scheduled</span>
                </b>
                <small>
                  {data.groups.find((g) => g.id === schedule.groupId)?.name || 'Deleted group'} · {schedule.interval} · starts {schedule.startDate}{schedule.endDate ? ` · ends ${schedule.endDate}` : ''}
                </small>
                <small>Next due: {schedule.active ? schedule.nextDueDate : 'Paused'}</small>
              </div>
              <strong>{formatMoney(schedule.amount, currency)}</strong>
              <div className="row-actions">
                <button
                  className="row-action"
                  aria-label={`Edit schedule for ${schedule.description}`}
                  title="Edit schedule"
                  onClick={() => openSchedule(schedule)}
                >
                  <Edit3 size={15} />
                </button>
                <button
                  className="button ghost small"
                  onClick={() => toggleRecurring(schedule.id, !schedule.active)}
                >
                  {schedule.active ? 'Pause' : 'Resume'}
                </button>
                <button
                  className="row-action delete-action"
                  aria-label={`Remove schedule for ${schedule.description}`}
                  title="Remove schedule"
                  onClick={() => removeSchedule(schedule)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            title="No recurring schedules"
            text="Set up recurring schedules for monthly rent, utilities, or weekly grocery runs."
            action={
              <button className="button ghost small" onClick={() => openSchedule()}>
                Create schedule
              </button>
            }
          />
        )}
      </section>

      {/* Modal for Expense / Recurrence Form */}
      {modal && (
        <Modal
          title={
            selectedSchedule
              ? 'Edit recurring schedule'
              : forceRecurring
              ? 'Schedule an expense'
              : selected
              ? 'Edit expense'
              : 'Add an expense'
          }
          onClose={closeModal}
        >
          <ExpenseForm
            groups={data.groups}
            members={data.members || []}
            initial={selectedSchedule || selected}
            forceRecurring={forceRecurring || Boolean(selectedSchedule)}
            storedReceiptBytes={getStoredReceiptBytes(data.expenses, selected?.id)}
            currency={currency}
            onClose={closeModal}
            onSave={saveForm}
          />
        </Modal>
      )}

      {/* Receipt Preview Modal */}
      {receiptViewExpense && receiptViewExpense.receipt && (
        <Modal
          title={`Receipt: ${receiptViewExpense.description}`}
          onClose={() => setReceiptViewExpense(null)}
        >
          <div className="receipt-view-modal">
            {receiptViewExpense.receipt.type === 'application/pdf' ? (
              <object
                data={receiptViewExpense.receipt.dataUrl}
                type="application/pdf"
                className="receipt-modal-object"
              >
                <p>PDF preview unavailable. <a href={receiptViewExpense.receipt.dataUrl} download={receiptViewExpense.receipt.name}>Download</a></p>
              </object>
            ) : (
              <img
                src={receiptViewExpense.receipt.dataUrl}
                alt="Receipt"
                className="receipt-modal-image"
              />
            )}
            <div className="modal-actions">
              <button className="button primary" onClick={() => setReceiptViewExpense(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. BALANCES PAGE (Phase 7)
// ---------------------------------------------------------------------------
export function BalancesPage({ data, settle }) {
  const currency = data.settings?.currency || 'INR';
  const balances = calculateBalances(data.expenses, data.settlements);
  const debts = simplifyDebts(balances);
  const pending = data.settlements.filter((item) => item.status === 'pending');
  const userId = data.user.id;
  const myNetBalance = balances[userId] || 0;

  const peopleWhoOweYou = debts.filter((d) => d.to === userId);
  const peopleYouOwe = debts.filter((d) => d.from === userId);

  const [settleModalDebt, setSettleModalDebt] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [reminderToast, setReminderToast] = useState('');

  const openSettleModal = (debt) => {
    setSettleModalDebt(debt);
    setSettleAmount(fromPaise(debt.amount));
    setSettleNote('Direct payment');
  };

  const handleRecordPayment = (e) => {
    e.preventDefault();
    if (!settleModalDebt) return;
    const amountPaise = Math.round(Number(settleAmount) * 100);
    if (!amountPaise || amountPaise <= 0) return;

    settle({
      from: settleModalDebt.from,
      to: settleModalDebt.to,
      amount: amountPaise,
      note: settleNote
    });

    setSettleModalDebt(null);
  };

  const sendReminder = (personId) => {
    const person = getMember(data, personId);
    setReminderToast(`Reminder notification sent to ${person.name}.`);
    setTimeout(() => setReminderToast(''), 4000);
  };

  return (
    <div className="page-content">
      {/* Top Header */}
      <div className="page-intro">
        <div>
          <p className="eyebrow">KEEP IT EVEN</p>
          <h2>Balances & Settlements</h2>
          <p>Optimized peer-to-peer transfers calculated from all your shared expenses.</p>
        </div>
        <Link className="button primary" to="/settlements">
          <Handshake size={16} /> Settlement history
        </Link>
      </div>

      {reminderToast && (
        <div className="toast-notification" role="status">
          <Check size={16} /> {reminderToast}
        </div>
      )}

      {/* Net Position Hero Card */}
      <section className="balance-hero">
        <div>
          <p>YOUR OVERALL NET POSITION</p>
          <h2 className={myNetBalance >= 0 ? 'green-text' : 'red-text'}>
            {myNetBalance >= 0 ? `+${formatMoney(myNetBalance, currency)}` : formatMoney(myNetBalance, currency)}
          </h2>
          <span>
            {myNetBalance > 0
              ? 'You are owed overall across all active groups'
              : myNetBalance < 0
              ? 'You owe overall across your active groups'
              : 'You are completely settled up!'}
          </span>
        </div>
        <div className="balance-orbit" aria-hidden="true">
          <span>{getCurrencySymbol(currency)}</span>
        </div>
      </section>

      {/* Two Column Layout: People Who Owe You / People You Owe */}
      <section className="two-col balances-two-col">
        {/* People You Owe */}
        <article className="panel">
          <header>
            <div>
              <p className="eyebrow">OUTSTANDING DEBTS</p>
              <h3>People You Owe ({peopleYouOwe.length})</h3>
            </div>
          </header>
          {peopleYouOwe.length ? (
            peopleYouOwe.map((debt) => {
              const isPending = pending.some((item) => item.from === debt.from && item.to === debt.to);
              const creditor = getMember(data, debt.to);

              return (
                <div className="debt-row" key={`${debt.from}-${debt.to}`}>
                  <Avatar member={creditor} />
                  <div>
                    <b>You owe {creditor.name}</b>
                    <small>Simplified outstanding balance</small>
                  </div>
                  <strong className="red-text">{formatMoney(debt.amount, currency)}</strong>
                  <button
                    className="button small primary"
                    disabled={isPending}
                    onClick={() => openSettleModal(debt)}
                  >
                    {isPending ? 'Payment pending' : 'Settle Up'}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="panel-empty">
              <CheckCircle2 size={24} className="green-text" />
              <p>Great news! You don't owe money to anyone.</p>
            </div>
          )}
        </article>

        {/* People Who Owe You */}
        <article className="panel">
          <header>
            <div>
              <p className="eyebrow">RECEIVABLES</p>
              <h3>People Who Owe You ({peopleWhoOweYou.length})</h3>
            </div>
          </header>
          {peopleWhoOweYou.length ? (
            peopleWhoOweYou.map((debt) => {
              const debtor = getMember(data, debt.from);
              const isPending = pending.some((item) => item.from === debt.from && item.to === debt.to);

              return (
                <div className="debt-row" key={`${debt.from}-${debt.to}`}>
                  <Avatar member={debtor} />
                  <div>
                    <b>{debtor.name} owes you</b>
                    <small>{isPending ? 'Payment marked pending' : 'Awaiting payment'}</small>
                  </div>
                  <strong className="green-text">{formatMoney(debt.amount, currency)}</strong>
                  <button
                    className="button small ghost"
                    onClick={() => sendReminder(debt.from)}
                    title="Send a simulated notification reminder"
                  >
                    Remind
                  </button>
                </div>
              );
            })
          ) : (
            <div className="panel-empty">
              <p>No one currently owes you money.</p>
            </div>
          )}
        </article>
      </section>

      {/* Full Workspace Individual Balances Table */}
      <article className="panel all-members-balance-panel">
        <header>
          <div>
            <p className="eyebrow">EVERYONE</p>
            <h3>All Member Net Balances</h3>
          </div>
        </header>
        <div className="person-balance-grid">
          {Object.entries(balances).map(([id, amount]) => {
            const person = getMember(data, id);
            return (
              <div className="person-balance" key={id}>
                <Avatar member={person} small />
                <span>{person.name} {id === userId ? '(You)' : ''}</span>
                <b className={amount >= 0 ? 'green-text' : 'red-text'}>
                  {amount >= 0 ? `+${formatMoney(amount, currency)}` : formatMoney(amount, currency)}
                </b>
              </div>
            );
          })}
        </div>
      </article>

      <p className="security-note">
        Balances are computed using integer paise and simplified debt graph algorithms. A pending settlement adjusts balances once confirmed by the receiver. Payments are simulated locally.
      </p>

      {/* Settle Up Modal */}
      {settleModalDebt && (
        <Modal
          title={`Settle Up with ${getMember(data, settleModalDebt.to).name}`}
          onClose={() => setSettleModalDebt(null)}
        >
          <form onSubmit={handleRecordPayment} className="form-grid">
            <div className="full settle-modal-intro">
              <Avatar member={getMember(data, settleModalDebt.to)} />
              <div>
                <strong>You are recording a payment to {getMember(data, settleModalDebt.to).name}</strong>
                <p>Total outstanding: {formatMoney(settleModalDebt.amount, currency)}</p>
              </div>
            </div>

            <label className="full">
              Amount to Pay ({getCurrencySymbol(currency)})
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                max={fromPaise(settleModalDebt.amount)}
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
              />
            </label>

            <label className="full">
              Payment Note / Method
              <select value={settleNote} onChange={(e) => setSettleNote(e.target.value)}>
                <option value="Direct payment">Direct Cash / Handover</option>
                <option value="UPI transfer">UPI / PhonePe / GPay</option>
                <option value="Bank transfer">IMPS / Bank Transfer</option>
                <option value="Card payment">Credit / Debit Card</option>
              </select>
            </label>

            <p className="security-note full">
              This will create a pending settlement record. The recipient can confirm the receipt to update both of your balances. No actual bank transfer is made.
            </p>

            <div className="modal-actions full">
              <button type="button" className="button ghost" onClick={() => setSettleModalDebt(null)}>
                Cancel
              </button>
              <button className="button primary" type="submit">
                Record Payment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. SETTLEMENTS PAGE (Phase 7)
// ---------------------------------------------------------------------------
export function SettlementsPage({ data, confirmSettlement, cancelSettlement, settle, setData }) {
  const currency = data.settings?.currency || 'INR';
  const [filter, setFilter] = useState('all'); // all, pending, settled, cancelled
  const [settleModal, setSettleModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');

  const pending = data.settlements.filter((item) => item.status === 'pending');
  const settled = data.settlements.filter((item) => item.status === 'settled');
  const cancelled = data.settlements.filter((item) => item.status === 'cancelled');

  // Debts and KPIs
  const allDebts = simplifyDebts(calculateBalances(data.expenses, data.settlements));
  const youOwe = allDebts
    .filter((d) => d.from === data.user.id)
    .reduce((sum, d) => sum + d.amount, 0);
  const youAreOwed = allDebts
    .filter((d) => d.to === data.user.id)
    .reduce((sum, d) => sum + d.amount, 0);
  const completedCount = settled.length;

  const handleRecordSettlement = (e) => {
    e.preventDefault();
    if (!selectedPerson) {
      alert('Please select a member to settle with.');
      return;
    }
    const val = parseFloat(settleAmount);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const payload = {
      from: data.user.id,
      to: selectedPerson,
      amount: toPaise(val),
      note: settleNote.trim() || 'Peer settlement'
    };

    if (settle) {
      settle(payload);
    } else if (setData) {
      setData((old) => ({
        ...old,
        settlements: [
          {
            id: createId(),
            ...payload,
            status: 'pending',
            date: today()
          },
          ...(old.settlements || [])
        ]
      }));
    }

    setSelectedGroup('');
    setSelectedPerson('');
    setSettleAmount('');
    setSettleNote('');
    setSettleModal(false);
  };

  // Directory candidates for record settlement
  const potentialPayees = (data.members || []).filter((m) => m.id !== data.user.id);

  return (
    <div className="page-content settlements-page">
      {/* Top Header */}
      <div className="page-intro">
        <div>
          <p className="eyebrow">PEER-TO-PEER PAYMENTS</p>
          <h2>Settle Up</h2>
          <p>Track money you owe and payments others owe you.</p>
        </div>
        <div className="page-actions">
          <button className="button primary" onClick={() => setSettleModal(true)}>
            <Handshake size={16} /> Record a Payment
          </button>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <section className="metrics" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
        <MetricCard
          label="YOU OWE"
          amount={youOwe}
          tone="negative"
          icon={TrendingDown}
          currency={currency}
          isMoney={true}
          note="Total outstanding debts you owe others"
        />
        <MetricCard
          label="YOU ARE OWED"
          amount={youAreOwed}
          tone="positive"
          icon={TrendingUp}
          currency={currency}
          isMoney={true}
          note="Total payments owed to you by others"
        />
        <MetricCard
          label="COMPLETED SETTLEMENTS"
          amount={completedCount}
          tone="neutral"
          icon={CheckCircle2}
          isMoney={false}
          note="Total confirmed peer payments"
        />
      </section>

      {/* Filter Tabs */}
      <div className="tabs-nav" role="tablist" style={{ marginBottom: '20px' }}>
        {[
          { key: 'all', label: `All Records (${data.settlements.length})` },
          { key: 'pending', label: `Pending Confirmation (${pending.length})` },
          { key: 'settled', label: `Completed (${settled.length})` },
          { key: 'cancelled', label: `Cancelled (${cancelled.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            className={`tab-btn ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 1. Pending Payments Section */}
      {(filter === 'all' || filter === 'pending') && (
        <article className="panel" style={{ marginBottom: '24px' }}>
          <header>
            <div>
              <p className="eyebrow">ACTION REQUIRED</p>
              <h3>Pending Payments ({pending.length})</h3>
            </div>
          </header>
          {pending.length ? (
            <div className="settlements-pending-list">
              {pending.map((item) => {
                const fromM = getMember(data, item.from);
                const toM = getMember(data, item.to);
                const isRecipient = item.to === data.user.id;
                const isPayer = item.from === data.user.id;

                return (
                  <div
                    className="settlement-row"
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--line)',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
                      <Avatar member={fromM} />
                      <div>
                        {isRecipient ? (
                          <div>
                            <b>{fromM.name}</b> marked <b>{formatMoney(item.amount, currency)}</b> as paid to you on {item.date}.
                          </div>
                        ) : isPayer ? (
                          <div>
                            You marked <b>{formatMoney(item.amount, currency)}</b> as paid to <b>{toM.name}</b> on {item.date}.
                            <span style={{ display: 'block', color: 'var(--orange)', fontSize: '12px', marginTop: '2px' }}>
                              Waiting for {toM.name} to confirm receipt.
                            </span>
                          </div>
                        ) : (
                          <div>
                            <b>{fromM.name}</b> marked <b>{formatMoney(item.amount, currency)}</b> as paid to <b>{toM.name}</b> on {item.date}.
                          </div>
                        )}
                        {item.note && (
                          <small style={{ display: 'block', color: 'var(--muted)', marginTop: '2px' }}>
                            Note: “{item.note}”
                          </small>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <b style={{ fontSize: '15px' }}>{formatMoney(item.amount, currency)}</b>
                      <span className="status-pill pending">Pending</span>

                      {/* Action buttons */}
                      {isRecipient ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="button primary small"
                            onClick={() => confirmSettlement && confirmSettlement(item.id)}
                            title="Confirm you received this payment and settle balance"
                          >
                            Confirm payment
                          </button>
                          <button
                            type="button"
                            className="button ghost small"
                            onClick={() => cancelSettlement && cancelSettlement(item.id)}
                            title="Reject payment notice if funds were not received"
                          >
                            Reject Payment
                          </button>
                        </div>
                      ) : isPayer ? (
                        <button
                          type="button"
                          className="button ghost small"
                          onClick={() => cancelSettlement && cancelSettlement(item.id)}
                          title="Cancel your unconfirmed payment notice"
                        >
                          Cancel Payment
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="button primary small"
                            onClick={() => confirmSettlement && confirmSettlement(item.id)}
                          >
                            Confirm payment
                          </button>
                          <button
                            type="button"
                            className="button ghost small"
                            onClick={() => cancelSettlement && cancelSettlement(item.id)}
                          >
                            Reject Payment
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="panel-empty" style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p>No pending payments awaiting confirmation.</p>
            </div>
          )}
        </article>
      )}

      {/* 2. Completed & Historical Payments Section */}
      {filter !== 'pending' && (
        <article className="panel settlement-history">
          <header>
            <div>
              <p className="eyebrow">AUDIT LEDGER</p>
              <h3>Completed & Historical Settlements ({filter === 'all' ? settled.length + cancelled.length : filter === 'settled' ? settled.length : cancelled.length})</h3>
            </div>
          </header>
          {(filter === 'settled' ? settled : filter === 'cancelled' ? cancelled : [...settled, ...cancelled]).length ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Payer</th>
                    <th>Recipient</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Initiated Date</th>
                    <th>Confirmed Date</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {(filter === 'settled' ? settled : filter === 'cancelled' ? cancelled : [...settled, ...cancelled]).map((item) => {
                    const fromM = getMember(data, item.from);
                    const toM = getMember(data, item.to);

                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar member={fromM} small />
                            <span>{fromM.name}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar member={toM} small />
                            <span>{toM.name}</span>
                          </div>
                        </td>
                        <td><b>{formatMoney(item.amount, currency)}</b></td>
                        <td>
                          <span className={`status-pill ${item.status === 'settled' ? 'active' : item.status === 'pending' ? 'pending' : 'neutral'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.date}</td>
                        <td>{item.confirmedAt || '—'}</td>
                        <td>{item.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-empty" style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p>No historical settlements found.</p>
            </div>
          )}
        </article>
      )}

      {/* Record a Payment Modal */}
      {settleModal && (
        <Modal title="Record a Payment (Settle Up)" onClose={() => setSettleModal(false)}>
          <form onSubmit={handleRecordSettlement} className="form-grid">
            <label className="full">
              Related Group (Optional)
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="">Direct / Cross-group</option>
                {data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="full">
              Recipient (Who did you pay?)
              <select
                required
                value={selectedPerson}
                onChange={(e) => {
                  setSelectedPerson(e.target.value);
                  const debt = allDebts.find((d) => d.from === data.user.id && d.to === e.target.value);
                  if (debt) {
                    setSettleAmount(fromPaise(debt.amount));
                  }
                }}
              >
                <option value="">Select a member...</option>
                {potentialPayees.map((m) => {
                  const debt = allDebts.find((d) => d.from === data.user.id && d.to === m.id);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} {debt ? `(You owe ${formatMoney(debt.amount, currency)})` : ''}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="full">
              Amount ({currency})
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
              />
            </label>

            <label className="full">
              Payment Method & Note
              <input
                type="text"
                maxLength="80"
                placeholder="e.g. Sent via UPI, Cash given in person"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />
            </label>

            <div className="security-note full" style={{ padding: '8px 0' }}>
              Notice: SplitSpace is an expense-sharing simulation tool. Recording a payment notifies the recipient to confirm receipt. No money is deducted from any real bank account.
            </div>

            <div className="modal-actions full">
              <button type="button" className="button ghost" onClick={() => setSettleModal(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit">
                Record Payment
              </button>
            </div>
          </form>
        </Modal>
      )}

      <p className="security-note" style={{ marginTop: '24px' }}>
        SplitSpace simulates settlements. No actual money is transferred.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. NOTIFICATIONS PAGE (Phase 10)
// ---------------------------------------------------------------------------
export function NotificationsPage({ data, setData }) {
  const [filter, setFilter] = useState('all'); // all, unread

  const markRead = (id) =>
    setData((old) => ({
      ...old,
      notifications: old.notifications.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    }));

  const allRead = () =>
    setData((old) => ({
      ...old,
      notifications: old.notifications.map((item) => ({ ...item, read: true }))
    }));

  const remove = (id) =>
    setData((old) => ({
      ...old,
      notifications: old.notifications.filter((item) => item.id !== id)
    }));

  const unreadCount = data.notifications.filter((item) => !item.read).length;
  const filtered = data.notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  return (
    <div className="page-content narrow">
      <div className="page-intro">
        <div>
          <p className="eyebrow">NOTIFICATION CENTRE</p>
          <h2>Your Notifications</h2>
          <p>{unreadCount} unread alert{unreadCount === 1 ? '' : 's'}</p>
        </div>
        <div className="page-actions">
          <button
            className="button ghost"
            disabled={unreadCount === 0}
            onClick={allRead}
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div className="tabs-nav" role="tablist">
        <button
          role="tab"
          aria-selected={filter === 'all'}
          className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({data.notifications.length})
        </button>
        <button
          role="tab"
          aria-selected={filter === 'unread'}
          className={`tab-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </button>
      </div>

      <article className="panel notifications">
        {filtered.length ? (
          filtered.map((note) => (
            <div className={note.read ? 'notification' : 'notification unread'} key={note.id}>
              <span className="notification-icon" aria-hidden="true">
                <Bell size={18} />
              </span>
              <div className="notification-body">
                <b>{note.title}</b>
                <p>{note.text}</p>
                <small>{note.date || 'Earlier'}</small>
              </div>
              <div className="row-actions">
                {!note.read && (
                  <button className="button ghost small" onClick={() => markRead(note.id)}>
                    Mark read
                  </button>
                )}
                <button
                  aria-label={`Delete notification: ${note.title}`}
                  className="icon-button delete-action"
                  onClick={() => remove(note.id)}
                  title="Delete notification"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            title="You're all caught up"
            text="New group invitations, expense additions, and settlement requests will show here."
          />
        )}
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. ACTIVITY PAGE
// ---------------------------------------------------------------------------
export function ActivityPage({ data }) {
  const currency = data.settings?.currency || 'INR';

  const entries = [
    ...data.expenses.map((expense) => ({
      id: expense.id,
      date: expense.date,
      text: `${getMember(data, expense.paidBy).name} added "${expense.description}"`,
      detail: `${data.groups.find((g) => g.id === expense.groupId)?.name || 'Group'} · ${formatMoney(expense.amount, currency)}`
    })),
    ...data.settlements.map((item) => ({
      id: `settlement-${item.id}`,
      date: item.confirmedAt || item.date,
      text: `${getMember(data, item.from).name} → ${getMember(data, item.to).name} settlement ${item.status}`,
      detail: formatMoney(item.amount, currency)
    }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="page-content narrow">
      <div className="page-intro">
        <div>
          <p className="eyebrow">AUDIT LOG</p>
          <h2>Activity History</h2>
          <p>Chronological feed of all recorded shared spending and settlements.</p>
        </div>
      </div>

      <article className="panel activity-list">
        {entries.length ? (
          entries.map((entry) => (
            <div key={entry.id}>
              <span><Activity size={17} /></span>
              <p>
                {entry.text}
                <small>{entry.detail} · {entry.date}</small>
              </p>
            </div>
          ))
        ) : (
          <EmptyState title="No activity yet" text="Shared actions will appear in this timeline." />
        )}
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. SETTINGS PAGE (Phase 9)
// ---------------------------------------------------------------------------
export function SettingsPage({
  data,
  theme,
  setTheme,
  setData,
  reset,
  logout,
  saveProfile,
  onSwitchRole
}) {
  const navigate = useNavigate();
  const [editingProfile, setEditingProfile] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');

  const preferences = data.settings?.notifications || {
    expenseUpdates: true,
    groupUpdates: true,
    settlementUpdates: true
  };
  const currentCurrency = data.settings?.currency || 'INR';
  const currentRole = data.user?.role || 'user';

  const updatePreference = (key, checked) =>
    setData((old) => ({
      ...old,
      settings: {
        ...old.settings,
        notifications: { ...old.settings?.notifications, [key]: checked }
      }
    }));

  const updateCurrency = (code) =>
    setData((old) => ({
      ...old,
      settings: { ...old.settings, currency: code }
    }));

  const profileSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    saveProfile({
      ...data.user,
      name: String(form.get('name')).trim(),
      email: String(form.get('email')).trim()
    });
    setEditingProfile(false);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordFeedback('Demo password updated in local memory.');
    setTimeout(() => setPasswordFeedback(''), 4000);
  };

  return (
    <div className="page-content narrow settings-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">YOUR PREFERENCES</p>
          <h2>Settings</h2>
          <p>Manage your profile, theme, currency, and local demo preferences.</p>
        </div>
      </div>

      <article className="panel settings">
        {/* Profile Section */}
        <h3>Profile</h3>
        <div>
          <div className="settings-profile-row">
            <Avatar member={data.user} />
            <div>
              <b>{data.user.name}</b>
              <p>{data.user.email || 'Demo profile stored on this device'}</p>
              <span className={`badge ${currentRole === 'admin' ? 'admin-pill' : 'neutral'}`}>
                {currentRole === 'admin' ? 'System Administrator' : 'Member Account'}
              </span>
            </div>
          </div>
          <button className="button ghost small" onClick={() => setEditingProfile(true)}>
            Edit profile
          </button>
        </div>

        {/* Demo Persona Role Switcher */}
        <h3>Role & Persona</h3>
        <div>
          <div>
            <b>Active Role: {currentRole === 'admin' ? 'Demo Admin' : 'Demo User'}</b>
            <p>Switch between Member workspace and Admin Console.</p>
          </div>
          <button
            className="button ghost small"
            onClick={() => {
              if (onSwitchRole) onSwitchRole(currentRole === 'admin' ? 'user' : 'admin');
              else navigate(currentRole === 'admin' ? '/dashboard' : '/admin');
            }}
          >
            Switch to {currentRole === 'admin' ? 'User Persona' : 'Admin Persona'}
          </button>
        </div>

        {/* Currency Preference */}
        <h3>Currency</h3>
        <div>
          <div>
            <b>Workspace Currency</b>
            <p>Select your preferred currency symbol and format.</p>
          </div>
          <div className="segmented">
            {[
              { code: 'INR', label: 'INR (₹)' },
              { code: 'USD', label: 'USD ($)' },
              { code: 'EUR', label: 'EUR (€)' },
              { code: 'GBP', label: 'GBP (£)' },
            ].map(({ code, label }) => (
              <button
                key={code}
                onClick={() => updateCurrency(code)}
                className={currentCurrency === code ? 'selected' : ''}
                aria-pressed={currentCurrency === code}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Appearance Section */}
        <h3>Appearance</h3>
        <div>
          <div>
            <b>Color theme</b>
            <p>Choose a light or dark workspace.</p>
          </div>
          <div className="segmented">
            <button
              onClick={() => setTheme('light')}
              className={theme === 'light' ? 'selected' : ''}
              aria-pressed={theme === 'light'}
            >
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={theme === 'dark' ? 'selected' : ''}
              aria-pressed={theme === 'dark'}
            >
              Dark
            </button>
          </div>
        </div>

        {/* Notifications Section */}
        <h3>Notifications</h3>
        {[
          ['expenseUpdates', 'Expense updates'],
          ['groupUpdates', 'Group updates'],
          ['settlementUpdates', 'Settlement updates']
        ].map(([key, label]) => (
          <div key={key}>
            <div>
              <b>{label}</b>
              <p>Show local notifications for {label.toLowerCase()}.</p>
            </div>
            <input
              type="checkbox"
              checked={preferences[key] !== false}
              onChange={(event) => updatePreference(key, event.target.checked)}
              aria-label={label}
            />
          </div>
        ))}

        {/* Demo Password Interface */}
        <h3>Security</h3>
        <div>
          <div>
            <b>Demo Password</b>
            <p>Simulate updating your account password.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="demo-password-form">
            <input
              type="password"
              placeholder="New demo password"
              minLength="4"
              required
              className="password-input"
            />
            <button type="submit" className="button ghost small">Update</button>
          </form>
        </div>
        {passwordFeedback && (
          <div className="toast-notification full" role="status">
            <Check size={16} /> {passwordFeedback}
          </div>
        )}

        {/* Demo Data Reset */}
        <h3>Demo data</h3>
        <div>
          <div>
            <b>Reset workspace</b>
            <p>Restore default bundled sample groups, members and expenses.</p>
          </div>
          <button className="button danger small" onClick={reset}>
            Reset demo data
          </button>
        </div>

        {/* Session Sign out */}
        <h3>Session</h3>
        <div>
          <div>
            <b>Sign out</b>
            <p>Clear this simulated local session.</p>
          </div>
          <button
            className="button ghost small"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Log out
          </button>
        </div>
      </article>

      <p className="security-note">
        Authentication and saved profile details are frontend-only simulations. All data is persisted in your browser's Local Storage.
      </p>

      {/* Edit Profile Modal */}
      {editingProfile && (
        <Modal title="Edit profile" onClose={() => setEditingProfile(false)}>
          <form className="form-grid" onSubmit={profileSubmit}>
            <label className="full">
              Full Name
              <input
                required
                name="name"
                defaultValue={data.user.name}
                maxLength="60"
              />
            </label>
            <label className="full">
              Email Address
              <input
                required
                name="email"
                type="email"
                defaultValue={data.user.email || 'aarav@splitspace.demo'}
              />
            </label>
            <div className="modal-actions full">
              <button type="button" className="button ghost" onClick={() => setEditingProfile(false)}>
                Cancel
              </button>
              <button className="button primary">Save profile</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 10. ADMIN PORTAL - Delegated to dedicated route components in AdminPages
// ---------------------------------------------------------------------------
export {
  AdminOverviewPage,
  AdminUsersPage,
  AdminGroupsPage,
  AdminExpensesPage,
  AdminSettlementsPage,
  AdminReportsPage,
  AdminSettingsPage,
  AdminPage
} from './AdminPages';
