import { lazy, Suspense, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  Handshake,
  Layers,
  ReceiptText,
  Search,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  XCircle
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';
import { formatMoney, fromPaise } from '../utils/money';
import { addMemberDirectory, updateMember } from '../utils/workspace';

const MonthlySpendChart = lazy(() => import('../components/AnalyticsCharts').then((module) => ({ default: module.MonthlySpendChart })));
const CategorySpendChart = lazy(() => import('../components/AnalyticsCharts').then((module) => ({ default: module.CategorySpendChart })));

const palette = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

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

const expenseTotal = (expenses) => expenses.reduce((sum, expense) => sum + expense.amount, 0);

// ============================================================================
// 1. ADMIN OVERVIEW PAGE (/admin)
// ============================================================================
export function AdminOverviewPage({ data }) {
  const currency = data.settings?.currency || 'INR';
  const totalSpend = expenseTotal(data.expenses);
  const pendingSettlements = data.settlements.filter((s) => s.status === 'pending');
  const completedSettlements = data.settlements.filter((s) => s.status === 'settled');

  const trend = useMemo(() => monthSeries(data.expenses), [data.expenses]);

  const categorySpend = useMemo(() => {
    const map = {};
    data.expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [data.expenses]);

  const groupSpend = useMemo(() => {
    return data.groups.map((g) => ({
      ...g,
      total: expenseTotal(data.expenses.filter((e) => e.groupId === g.id))
    })).sort((a, b) => b.total - a.total);
  }, [data.groups, data.expenses]);

  const exportReport = () => {
    downloadCsv('splitspace-platform-summary.csv', [
      ['Metric', 'Value'],
      ['Total Members', data.members?.length || 0],
      ['Total Groups', data.groups.length],
      ['Total Expenses Count', data.expenses.length],
      [`Total Recorded Spend (${currency})`, fromPaise(totalSpend)],
      ['Pending Settlements Count', pendingSettlements.length],
      [`Pending Settlements Amount (${currency})`, fromPaise(expenseTotal(pendingSettlements))],
      ['Completed Settlements Count', completedSettlements.length],
      [`Completed Settlements Amount (${currency})`, fromPaise(expenseTotal(completedSettlements))]
    ]);
  };

  return (
    <div className="page-content admin-page">
      <div className="admin-notice">
        <ShieldCheck size={16} />
        <span>SIMULATED ADMIN CONSOLE · All telemetry and records are stored locally in your browser.</span>
      </div>

      <div className="page-intro">
        <div>
          <p className="eyebrow">PLATFORM OVERSIGHT</p>
          <h2>Admin Overview</h2>
          <p>Recorded activity · Real-time analytics and management computed from your local workspace state.</p>
        </div>
        <div className="page-actions">
          <button className="button ghost" onClick={exportReport} title="Download complete platform CSV">
            <Download size={16} /> Export report
          </button>
        </div>
      </div>

      {/* 7 Admin KPIs */}
      <section className="metrics admin-metrics" aria-label="Admin KPI summary">
        <MetricCard
          label="LOCAL MEMBERS"
          amount={data.members?.length || 0}
          tone="neutral"
          icon={Users}
          isMoney={false}
          note="Member directory records"
        />
        <MetricCard
          label="ACTIVE GROUPS"
          amount={data.groups.length}
          tone="positive"
          icon={Layers}
          isMoney={false}
          note="Groups in this workspace"
        />
        <MetricCard
          label="RECORDED SPEND"
          amount={totalSpend}
          tone="warning"
          icon={ReceiptText}
          currency={currency}
          isMoney={true}
          note={`${data.expenses.length} expenses`}
        />
        <MetricCard
          label="PENDING SETTLEMENTS"
          amount={expenseTotal(pendingSettlements)}
          tone="negative"
          icon={Activity}
          currency={currency}
          isMoney={true}
          note={`${pendingSettlements.length} awaiting confirmation`}
        />
      </section>

      {/* Charts Row */}
      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <header>
            <div>
              <p className="eyebrow">RECORDED SPEND</p>
              <h3>Monthly Expense Volume</h3>
            </div>
          </header>
          <Suspense fallback={<p className="panel-empty">Loading chart…</p>}>
            <MonthlySpendChart data={trend} currency={currency} />
          </Suspense>
        </article>

        <article className="panel category-panel">
          <header>
            <div>
              <p className="eyebrow">BY GROUP</p>
              <h3>Group spend</h3>
            </div>
          </header>
          <div className="group-spend-list" style={{ padding: '0 20px 20px' }}>
            {groupSpend.map((g) => (
              <div key={g.id} className="group-spend-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span><strong>{g.name}</strong></span>
                <b>{formatMoney(g.total, currency)}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel category-panel">
          <header>
            <div>
              <p className="eyebrow">CATEGORIES</p>
              <h3>Spend distribution</h3>
            </div>
          </header>
          <Suspense fallback={<p className="panel-empty">Loading breakdown…</p>}>
            <CategorySpendChart data={categorySpend} currency={currency} />
          </Suspense>
        </article>

        <article className="panel">
          <header>
            <div>
              <p className="eyebrow">MEMBER DIRECTORY</p>
              <h3>Workspace members</h3>
            </div>
            <Link className="button ghost small" to="/admin/users">
              View all users →
            </Link>
          </header>
          <div className="member-list-compact" style={{ padding: '0 20px 20px' }}>
            {(data.members || []).slice(0, 5).map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar member={m} small />
                  <div>
                    <strong>{m.name}</strong>
                    <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px' }}>{m.email}</small>
                  </div>
                </div>
                <span className={`status-pill ${m.role === 'admin' ? 'active' : 'neutral'}`}>{m.role}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Transaction Report */}
      <article className="panel recent-panel" style={{ marginTop: '20px' }}>
        <header>
          <div>
            <p className="eyebrow">TRANSACTION REPORT</p>
            <h3>Recent records</h3>
          </div>
          <Link className="button ghost small" to="/admin/expenses">
            View all expenses →
          </Link>
        </header>
        {data.expenses.slice(0, 5).map((expense) => {
          const group = data.groups.find((g) => g.id === expense.groupId);
          const payer = data.members?.find((m) => m.id === expense.paidBy) || { name: 'Unknown' };
          return (
            <div key={expense.id} className="expense-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
              <div>
                <b>{expense.description}</b>
                <small style={{ display: 'block', color: 'var(--muted)', fontSize: '11px' }}>
                  {group?.name || 'Group'} · {expense.date} · Paid by {payer.name}
                </small>
              </div>
              <b>{formatMoney(expense.amount, currency)}</b>
            </div>
          );
        })}
      </article>
    </div>
  );
}

// ============================================================================
// 2. ADMIN USERS PAGE (/admin/users)
// ============================================================================
export function AdminUsersPage({ data, setData }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [newUserModal, setNewUserModal] = useState(false);

  const members = data.members || [];

  const filtered = members.filter((m) => {
    const matchesSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (m.status || 'active') === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleEditUser = (e) => {
    e.preventDefault();
    if (!editingUser) return;
    const form = e.currentTarget || e.target;
    const nameInput = form.querySelector ? form.querySelector('input[name="name"]') : null;
    const emailInput = form.querySelector ? form.querySelector('input[name="email"]') : null;
    const name = (nameInput?.value ?? form.elements?.name?.value ?? form.name?.value ?? '').trim();
    const email = (emailInput?.value ?? form.elements?.email?.value ?? form.email?.value ?? '').trim();
    if (!name) return;

    setData((old) => updateMember(old, editingUser.id, { name, email }));
    setEditingUser(null);
  };

  const handleAddUser = (e) => {
    e.preventDefault();
    const form = e.currentTarget || e.target;
    const nameInput = form.querySelector ? (form.querySelector('input[placeholder*="Batra"]') || form.querySelector('input[name="name"]')) : null;
    const emailInput = form.querySelector ? (form.querySelector('input[placeholder*="splitspace"]') || form.querySelector('input[name="email"]')) : null;
    const roleSelect = form.querySelector ? form.querySelector('select[name="role"]') : null;
    const name = (nameInput?.value ?? form.elements?.name?.value ?? form.name?.value ?? '').trim();
    const email = (emailInput?.value ?? form.elements?.email?.value ?? form.email?.value ?? '').trim();
    const role = roleSelect?.value ?? form.elements?.role?.value ?? form.role?.value ?? 'user';
    if (!name) return;

    const newId = `user-${Date.now().toString(36)}`;
    const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
    const newPerson = {
      id: newId,
      name,
      email: email || `${newId}@splitspace.demo`,
      initials: initials || 'DU',
      color: palette[members.length % palette.length],
      role,
      status: 'active',
      registeredAt: new Date().toISOString().slice(0, 10)
    };

    setData((old) => addMemberDirectory(old, newPerson));
    setNewUserModal(false);
  };

  const toggleUserRole = (member) => {
    const newRole = member.role === 'admin' ? 'user' : 'admin';
    setData((old) => updateMember(old, member.id, { role: newRole }));
  };

  const toggleUserStatus = (member) => {
    const newStatus = member.status === 'suspended' ? 'active' : 'suspended';
    setData((old) => updateMember(old, member.id, { status: newStatus }));
  };

  const exportUsersCsv = () => {
    downloadCsv('splitspace-users.csv', [
      ['ID', 'Name', 'Email', 'Role', 'Status', 'Registered Date', 'Groups Count', 'Expenses Paid'],
      ...members.map((m) => [
        m.id,
        m.name,
        m.email,
        m.role,
        m.status || 'active',
        m.registeredAt || '2026-10-15',
        data.groups.filter((g) => g.members.includes(m.id)).length,
        data.expenses.filter((e) => e.paidBy === m.id).length
      ])
    ]);
  };

  return (
    <div className="page-content admin-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">ADMIN CONSOLE / USER MANAGEMENT</p>
          <h2>User Management</h2>
          <p>Directory of registered workspace members, roles, statuses, and privileges.</p>
        </div>
        <div className="page-actions">
          <button className="button primary" onClick={() => setNewUserModal(true)}>
            <UserPlus size={16} /> Add Demo User
          </button>
          <button className="button ghost" onClick={exportUsersCsv}>
            <Download size={16} /> Export Users CSV
          </button>
        </div>
      </div>

      <div className="list-toolbar" style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div className="search" style={{ flex: '1', minWidth: '220px' }}>
          <Search size={16} />
          <input
            type="search"
            placeholder="Search users by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="admin">Administrators</option>
          <option value="user">Standard Users</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <article className="panel">
        <header>
          <div>
            <p className="eyebrow">ADMINISTRATION</p>
            <h3>Registered Users Directory</h3>
          </div>
        </header>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Registration Date</th>
                <th>Groups Count</th>
                <th>Expenses Paid</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const groupCount = data.groups.filter((g) => g.members.includes(m.id)).length;
                const expenseCount = data.expenses.filter((e) => e.paidBy === m.id).length;
                const isSuspended = m.status === 'suspended';

                return (
                  <tr key={m.id}>
                    <td>
                      <div className="user-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Avatar member={m} small />
                        <strong>{m.name}</strong>
                      </div>
                    </td>
                    <td>{m.email}</td>
                    <td>{m.registeredAt || '2026-10-15'}</td>
                    <td>{groupCount}</td>
                    <td>{expenseCount}</td>
                    <td>
                      <span className={`status-pill ${m.role === 'admin' ? 'active' : 'neutral'}`}>
                        {m.role === 'admin' ? 'Administrator' : 'User'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${isSuspended ? 'negative' : 'active'}`}>
                        {isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons-cell" style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="button ghost small"
                          onClick={() => setEditingUser(m)}
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="button ghost small"
                          onClick={() => toggleUserRole(m)}
                        >
                          {m.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          type="button"
                          className={`button small ${isSuspended ? 'primary' : 'ghost'}`}
                          onClick={() => toggleUserStatus(m)}
                        >
                          {isSuspended ? 'Activate' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                    No users match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Edit User Modal */}
      {editingUser && (
        <Modal title={`Edit ${editingUser.name}`} onClose={() => setEditingUser(null)}>
          <form onSubmit={handleEditUser} className="form-grid">
            <label className="full">
              Full Name
              <input name="name" defaultValue={editingUser.name} required />
            </label>
            <label className="full">
              Email Address
              <input name="email" type="email" defaultValue={editingUser.email} required />
            </label>
            <div className="modal-actions full">
              <button type="button" className="button ghost" onClick={() => setEditingUser(null)}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Demo User Modal */}
      {newUserModal && (
        <Modal title="Add Demo User" onClose={() => setNewUserModal(false)}>
          <form onSubmit={handleAddUser} className="form-grid">
            <label className="full">
              Full Name
              <input name="name" placeholder="e.g. Vikram Batra" required />
            </label>
            <label className="full">
              Email Address
              <input name="email" type="email" placeholder="vikram@splitspace.demo" />
            </label>
            <label className="full">
              Account Role
              <select name="role" defaultValue="user">
                <option value="user">Standard User</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <div className="modal-actions full">
              <button type="button" className="button ghost" onClick={() => setNewUserModal(false)}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Add Demo User
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// 3. ADMIN GROUPS PAGE (/admin/groups)
// ============================================================================
export function AdminGroupsPage({ data }) {
  const currency = data.settings?.currency || 'INR';
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const groups = data.groups.map((g) => {
    const gExpenses = data.expenses.filter((e) => e.groupId === g.id);
    const totalSpent = expenseTotal(gExpenses);
    const owner = data.members?.find((m) => m.id === g.createdBy || m.id === g.members[0]) || { name: 'Aarav Mehta' };
    return {
      ...g,
      totalSpent,
      expenseCount: gExpenses.length,
      owner
    };
  });

  const filtered = groups.filter((g) => {
    const matchesSearch = !search || g.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = catFilter === 'all' || g.category === catFilter;
    return matchesSearch && matchesCat;
  });

  const exportGroupsCsv = () => {
    downloadCsv('splitspace-groups.csv', [
      ['Group ID', 'Name', 'Category', 'Owner', 'Members Count', 'Expenses Count', `Total Spend (${currency})`, 'Created Date'],
      ...groups.map((g) => [
        g.id,
        g.name,
        g.category,
        g.owner.name,
        g.members.length,
        g.expenseCount,
        fromPaise(g.totalSpent),
        g.createdAt || '2026-10-15'
      ])
    ]);
  };

  return (
    <div className="page-content admin-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">ADMIN CONSOLE / GROUP MANAGEMENT</p>
          <h2>Group Management</h2>
          <p>Audit and manage active sharing groups, group owners, membership density, and total spend.</p>
        </div>
        <div className="page-actions">
          <button className="button ghost" onClick={exportGroupsCsv}>
            <Download size={16} /> Export Groups CSV
          </button>
        </div>
      </div>

      <div className="list-toolbar" style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
        <div className="search" style={{ flex: '1' }}>
          <Search size={16} />
          <input
            type="search"
            placeholder="Search groups by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="Travel">Travel</option>
          <option value="Roommates">Roommates</option>
          <option value="Friends">Friends</option>
          <option value="Office">Office</option>
          <option value="College">College</option>
        </select>
      </div>

      <article className="panel">
        <header>
          <div>
            <p className="eyebrow">OVERSIGHT</p>
            <h3>Active Sharing Groups</h3>
          </div>
        </header>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Category</th>
                <th>Owner</th>
                <th>Members Count</th>
                <th>Total Expenses</th>
                <th>Total Spend</th>
                <th>Creation Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{g.emoji || '✦'}</span>
                      <strong>{g.name}</strong>
                    </div>
                  </td>
                  <td><span className="badge soft">{g.category}</span></td>
                  <td>{g.owner.name}</td>
                  <td>{g.members.length} members</td>
                  <td>{g.expenseCount}</td>
                  <td><b>{formatMoney(g.totalSpent, currency)}</b></td>
                  <td>{g.createdAt || '2026-10-15'}</td>
                  <td>
                    <Link className="button ghost small" to={`/groups/${g.id}`}>
                      <Eye size={13} /> View Group
                    </Link>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                    No groups match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

// ============================================================================
// 4. ADMIN EXPENSES PAGE (/admin/expenses)
// ============================================================================
export function AdminExpensesPage({ data }) {
  const currency = data.settings?.currency || 'INR';
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [selectedExpense, setSelectedExpense] = useState(null);

  const expenses = data.expenses.map((e) => {
    const group = data.groups.find((g) => g.id === e.groupId);
    const payer = data.members?.find((m) => m.id === e.paidBy) || { name: 'Unknown' };
    return { ...e, group, payer };
  });

  const filtered = expenses.filter((e) => {
    const matchesSearch = !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.payer.name.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = groupFilter === 'all' || e.groupId === groupFilter;
    const matchesCat = catFilter === 'all' || e.category === catFilter;
    return matchesSearch && matchesGroup && matchesCat;
  });

  const exportExpensesCsv = () => {
    downloadCsv('splitspace-expenses.csv', [
      ['Expense ID', 'Description', 'Group', 'Category', 'Paid By', `Total Amount (${currency})`, 'Date', 'Split Method'],
      ...expenses.map((e) => [
        e.id,
        e.description,
        e.group?.name || 'Deleted Group',
        e.category,
        e.payer.name,
        fromPaise(e.amount),
        e.date,
        e.splitMethod || 'equal'
      ])
    ]);
  };

  return (
    <div className="page-content admin-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">ADMIN CONSOLE / EXPENSE MONITORING</p>
          <h2>Expense Monitoring</h2>
          <p>Real-time ledger of all shared transactions across groups, split methods, and receipts.</p>
        </div>
        <div className="page-actions">
          <button className="button ghost" onClick={exportExpensesCsv}>
            <Download size={16} /> Export Expenses CSV
          </button>
        </div>
      </div>

      <div className="list-toolbar" style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div className="search" style={{ flex: '1', minWidth: '220px' }}>
          <Search size={16} />
          <input
            type="search"
            placeholder="Search by description or payer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="all">All Groups</option>
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="Food">Food</option>
          <option value="Travel">Travel</option>
          <option value="Utilities">Utilities</option>
          <option value="Shopping">Shopping</option>
          <option value="Entertainment">Entertainment</option>
        </select>
      </div>

      <article className="panel">
        <header>
          <div>
            <p className="eyebrow">TRANSACTION AUDIT</p>
            <h3>Global Expenses ({filtered.length})</h3>
          </div>
        </header>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Group</th>
                <th>Category</th>
                <th>Paid By</th>
                <th>Total Amount</th>
                <th>Date</th>
                <th>Split Method</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.description}</strong>
                    {e.receipt && <span className="source-badge" style={{ marginLeft: '8px' }}>Receipt</span>}
                  </td>
                  <td>{e.group?.name || 'General'}</td>
                  <td><span className="badge soft">{e.category}</span></td>
                  <td>{e.payer.name}</td>
                  <td><b>{formatMoney(e.amount, currency)}</b></td>
                  <td>{e.date}</td>
                  <td><span className="badge neutral">{e.splitMethod || 'equal'}</span></td>
                  <td>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => setSelectedExpense(e)}
                    >
                      <Eye size={13} /> View Split
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                    No expenses match your search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Split Details Modal */}
      {selectedExpense && (
        <Modal title={`Split Details: ${selectedExpense.description}`} onClose={() => setSelectedExpense(null)}>
          <div style={{ padding: '10px 0' }}>
            <p style={{ marginBottom: '16px', color: 'var(--muted)' }}>
              Total: <strong>{formatMoney(selectedExpense.amount, currency)}</strong> · Paid by <strong>{selectedExpense.payer.name}</strong>
            </p>
            <h4>Participant Shares:</h4>
            <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
              {Object.entries(selectedExpense.shares || {}).map(([memberId, shareAmount]) => {
                const member = data.members?.find((m) => m.id === memberId) || { name: memberId };
                return (
                  <div key={memberId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--panel-2)', borderRadius: '6px' }}>
                    <span>{member.name}</span>
                    <b>{formatMoney(shareAmount, currency)}</b>
                  </div>
                );
              })}
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="button primary" onClick={() => setSelectedExpense(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// 5. ADMIN SETTLEMENTS PAGE (/admin/settlements)
// ============================================================================
export function AdminSettlementsPage({ data, confirmSettlement, cancelSettlement }) {
  const currency = data.settings?.currency || 'INR';
  const [statusFilter, setStatusFilter] = useState('all');

  const pending = data.settlements.filter((s) => s.status === 'pending');
  const settled = data.settlements.filter((s) => s.status === 'settled');
  const cancelled = data.settlements.filter((s) => s.status === 'cancelled');
  const totalValue = expenseTotal(data.settlements);

  const filtered = data.settlements.filter((s) => {
    return statusFilter === 'all' || s.status === statusFilter;
  });

  const exportSettlementsCsv = () => {
    downloadCsv('splitspace-settlements.csv', [
      ['Settlement ID', 'From', 'To', `Amount (${currency})`, 'Status', 'Date', 'Confirmed Date'],
      ...data.settlements.map((s) => {
        const fromMember = data.members?.find((m) => m.id === s.from) || { name: s.from };
        const toMember = data.members?.find((m) => m.id === s.to) || { name: s.to };
        return [
          s.id,
          fromMember.name,
          toMember.name,
          fromPaise(s.amount),
          s.status,
          s.date,
          s.confirmedAt || ''
        ];
      })
    ]);
  };

  return (
    <div className="page-content admin-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">ADMIN CONSOLE / SETTLEMENTS OVERSIGHT</p>
          <h2>Platform Settlements</h2>
          <p>Global audit log of peer-to-peer settlement requests, confirmations, and cancellations.</p>
        </div>
        <div className="page-actions">
          <button className="button ghost" onClick={exportSettlementsCsv}>
            <Download size={16} /> Export Settlements CSV
          </button>
        </div>
      </div>

      {/* 5 KPI Summary Cards */}
      <section className="metrics" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '24px' }}>
        <MetricCard
          label="TOTAL RECORDS"
          amount={data.settlements.length}
          tone="neutral"
          icon={Handshake}
          isMoney={false}
          note="All recorded settlements"
        />
        <MetricCard
          label="PENDING"
          amount={pending.length}
          tone="warning"
          icon={Clock}
          isMoney={false}
          note="Awaiting recipient action"
        />
        <MetricCard
          label="COMPLETED"
          amount={settled.length}
          tone="positive"
          icon={CheckCircle2}
          isMoney={false}
          note="Confirmed peer payments"
        />
        <MetricCard
          label="CANCELLED"
          amount={cancelled.length}
          tone="neutral"
          icon={XCircle}
          isMoney={false}
          note="Disputed or voided"
        />
        <MetricCard
          label="TOTAL VALUE"
          amount={totalValue}
          tone="neutral"
          icon={Wallet}
          currency={currency}
          isMoney={true}
          note="Combined transaction volume"
        />
      </section>

      <div className="list-toolbar" style={{ marginBottom: '20px' }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses ({data.settlements.length})</option>
          <option value="pending">Pending ({pending.length})</option>
          <option value="settled">Completed ({settled.length})</option>
          <option value="cancelled">Cancelled ({cancelled.length})</option>
        </select>
      </div>

      <article className="panel">
        <header>
          <div>
            <p className="eyebrow">AUDIT LEDGER</p>
            <h3>Settlement Records</h3>
          </div>
        </header>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>From Member</th>
                <th>To Member</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Confirmed Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const fromM = data.members?.find((m) => m.id === s.from) || { name: s.from };
                const toM = data.members?.find((m) => m.id === s.to) || { name: s.to };

                return (
                  <tr key={s.id}>
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
                    <td><b>{formatMoney(s.amount, currency)}</b></td>
                    <td>
                      <span className={`status-pill ${s.status === 'settled' ? 'active' : s.status === 'pending' ? 'pending' : 'neutral'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>{s.date}</td>
                    <td>{s.confirmedAt || '—'}</td>
                    <td>
                      {s.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {confirmSettlement && (
                            <button
                              type="button"
                              className="button primary small"
                              onClick={() => confirmSettlement(s.id)}
                            >
                              Confirm
                            </button>
                          )}
                          {cancelSettlement && (
                            <button
                              type="button"
                              className="button ghost small"
                              onClick={() => cancelSettlement(s.id)}
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                    No settlements match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

// ============================================================================
// 6. ADMIN REPORTS PAGE (/admin/reports)
// ============================================================================
export function AdminReportsPage({ data }) {
  const currency = data.settings?.currency || 'INR';
  const totalSpend = expenseTotal(data.expenses);
  const pendingSettlements = data.settlements.filter((s) => s.status === 'pending');
  const completedSettlements = data.settlements.filter((s) => s.status === 'settled');

  const exportPlatformSummary = () => {
    downloadCsv('splitspace-platform-summary.csv', [
      ['Report Name', 'SplitSpace Executive Platform Summary'],
      ['Generated Date', new Date().toISOString().slice(0, 10)],
      ['Total Registered Members', data.members?.length || 0],
      ['Total Groups Active', data.groups.length],
      ['Total Transactions Recorded', data.expenses.length],
      [`Total Recorded Spend (${currency})`, fromPaise(totalSpend)],
      ['Pending Settlements Count', pendingSettlements.length],
      [`Pending Settlements Amount (${currency})`, fromPaise(expenseTotal(pendingSettlements))],
      ['Completed Settlements Count', completedSettlements.length],
      [`Completed Settlements Amount (${currency})`, fromPaise(expenseTotal(completedSettlements))]
    ]);
  };

  const exportUsersCsv = () => {
    downloadCsv('splitspace-users.csv', [
      ['ID', 'Name', 'Email', 'Role', 'Status', 'Registered Date', 'Groups Count', 'Expenses Paid'],
      ...(data.members || []).map((m) => [
        m.id,
        m.name,
        m.email,
        m.role,
        m.status || 'active',
        m.registeredAt || '2026-10-15',
        data.groups.filter((g) => g.members.includes(m.id)).length,
        data.expenses.filter((e) => e.paidBy === m.id).length
      ])
    ]);
  };

  const exportGroupsCsv = () => {
    downloadCsv('splitspace-groups.csv', [
      ['Group ID', 'Name', 'Category', 'Members Count', 'Expenses Count', `Total Spend (${currency})`, 'Created Date'],
      ...data.groups.map((g) => {
        const gExpenses = data.expenses.filter((e) => e.groupId === g.id);
        return [
          g.id,
          g.name,
          g.category,
          g.members.length,
          g.expenseCount || gExpenses.length,
          fromPaise(expenseTotal(gExpenses)),
          g.createdAt || '2026-10-15'
        ];
      })
    ]);
  };

  const exportExpensesCsv = () => {
    downloadCsv('splitspace-expenses.csv', [
      ['Expense ID', 'Description', 'Group', 'Category', 'Paid By', `Amount (${currency})`, 'Date', 'Split Method'],
      ...data.expenses.map((e) => [
        e.id,
        e.description,
        data.groups.find((g) => g.id === e.groupId)?.name || 'General',
        e.category,
        data.members?.find((m) => m.id === e.paidBy)?.name || e.paidBy,
        fromPaise(e.amount),
        e.date,
        e.splitMethod || 'equal'
      ])
    ]);
  };

  const exportSettlementsCsv = () => {
    downloadCsv('splitspace-settlements.csv', [
      ['Settlement ID', 'From', 'To', `Amount (${currency})`, 'Status', 'Date', 'Confirmed Date'],
      ...data.settlements.map((s) => [
        s.id,
        data.members?.find((m) => m.id === s.from)?.name || s.from,
        data.members?.find((m) => m.id === s.to)?.name || s.to,
        fromPaise(s.amount),
        s.status,
        s.date,
        s.confirmedAt || ''
      ])
    ]);
  };

  return (
    <div className="page-content admin-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">ADMIN CONSOLE / REPORTS & EXPORTS</p>
          <h2>Platform Reports</h2>
          <p>Generate and export platform telemetry, user audits, group summaries, and financial ledgers.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <article className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '10px', background: 'var(--primary-soft)', borderRadius: '8px', color: 'var(--primary)' }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>Platform Summary Report</h3>
                <small style={{ color: 'var(--muted)' }}>Overview of all metrics and platform health</small>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
              Contains platform-wide aggregates including total volume, group counts, active members, and settlement totals.
            </p>
          </div>
          <button className="button primary" onClick={exportPlatformSummary}>
            <Download size={15} /> Download Platform Report
          </button>
        </article>

        <article className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: 'var(--green)' }}>
                <Users size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>Registered Users Directory</h3>
                <small style={{ color: 'var(--muted)' }}>{data.members?.length || 0} user records</small>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
              Export of all registered members with emails, account roles, statuses, registration dates, and activity counts.
            </p>
          </div>
          <button className="button ghost" onClick={exportUsersCsv}>
            <Download size={15} /> Download Users CSV
          </button>
        </article>

        <article className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: '#3b82f6' }}>
                <Layers size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>Group Financial Summaries</h3>
                <small style={{ color: 'var(--muted)' }}>{data.groups.length} active circles</small>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
              Group breakdown showing categories, member density, total spending, and expense counts.
            </p>
          </div>
          <button className="button ghost" onClick={exportGroupsCsv}>
            <Download size={15} /> Download Groups CSV
          </button>
        </article>

        <article className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', color: 'var(--orange)' }}>
                <ReceiptText size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>Transaction Ledger</h3>
                <small style={{ color: 'var(--muted)' }}>{data.expenses.length} expense transactions</small>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
              Itemized list of every expense recorded across all groups, with payers, categories, split allocations, and amounts.
            </p>
          </div>
          <button className="button ghost" onClick={exportExpensesCsv}>
            <Download size={15} /> Download Expenses CSV
          </button>
        </article>

        <article className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', color: '#8b5cf6' }}>
                <Handshake size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>Settlements Audit Log</h3>
                <small style={{ color: 'var(--muted)' }}>{data.settlements.length} settlement records</small>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
              Complete audit of all peer-to-peer settlement requests, confirmations, dates, and amounts.
            </p>
          </div>
          <button className="button ghost" onClick={exportSettlementsCsv}>
            <Download size={15} /> Download Settlements CSV
          </button>
        </article>
      </div>
    </div>
  );
}

// ============================================================================
// 7. ADMIN SETTINGS PAGE (/admin/settings)
// ============================================================================
export function AdminSettingsPage({ data, setData, theme, setTheme, reset, onSwitchRole }) {
  const currency = data.settings?.currency || 'INR';

  const setCurrency = (c) => {
    setData((old) => ({
      ...old,
      settings: {
        ...old.settings,
        currency: c
      }
    }));
  };

  return (
    <div className="page-content admin-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">ADMIN CONSOLE / SETTINGS</p>
          <h2>Admin Settings</h2>
          <p>Simulated administrator preferences, workspace configuration, and developer testing tools.</p>
        </div>
      </div>

      <article className="panel settings" style={{ marginBottom: '24px' }}>
        <h3>Platform Administrator Persona</h3>
        <div>
          <div>
            <strong>Active Admin Account</strong>
            <p>System Admin · admin@splitspace.demo</p>
          </div>
          <span className="badge active">Administrator</span>
        </div>
        <div>
          <div>
            <strong>Switch to User Workspace</strong>
            <p>Return to the member view as Aarav Mehta to test expense creation and personal balances.</p>
          </div>
          <button
            type="button"
            className="button ghost small"
            onClick={() => onSwitchRole && onSwitchRole('user')}
          >
            <ArrowLeftRight size={14} /> Switch to User
          </button>
        </div>
      </article>

      <article className="panel settings" style={{ marginBottom: '24px' }}>
        <h3>Display & Currency</h3>
        <div>
          <div>
            <strong>Platform Currency</strong>
            <p>All calculations across the platform use integer cents/paise in this currency.</p>
          </div>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--panel-2)' }}>
            <option value="INR">INR (₹) Indian Rupee</option>
            <option value="USD">USD ($) US Dollar</option>
            <option value="EUR">EUR (€) Euro</option>
            <option value="GBP">GBP (£) British Pound</option>
          </select>
        </div>
        <div>
          <div>
            <strong>Theme Appearance</strong>
            <p>Select light or dark fintech theme.</p>
          </div>
          <div className="segmented">
            <button
              className={theme === 'light' ? 'selected' : ''}
              onClick={() => setTheme && setTheme('light')}
            >
              Light
            </button>
            <button
              className={theme === 'dark' ? 'selected' : ''}
              onClick={() => setTheme && setTheme('dark')}
            >
              Dark
            </button>
          </div>
        </div>
      </article>

      <article className="panel settings">
        <h3>Developer Reset & Maintenance</h3>
        <div>
          <div>
            <strong>Reset Workspace Demo Data</strong>
            <p>Restore the application to default demo accounts, seed groups, and initial transactions.</p>
          </div>
          <button
            type="button"
            className="button danger small"
            onClick={() => reset && reset()}
          >
            Reset All Data
          </button>
        </div>
      </article>
    </div>
  );
}

// ============================================================================
// BACKWARD-COMPATIBLE ADMIN WRAPPER
// ============================================================================
export function AdminPage({ data, setData, section = 'overview', confirmSettlement, theme, setTheme, reset, onSwitchRole }) {
  const location = useLocation();

  const currentSection = location.pathname.includes('/users')
    ? 'users'
    : location.pathname.includes('/groups')
    ? 'groups'
    : location.pathname.includes('/expenses')
    ? 'expenses'
    : location.pathname.includes('/settlements')
    ? 'settlements'
    : location.pathname.includes('/reports')
    ? 'reports'
    : location.pathname.includes('/settings')
    ? 'settings'
    : section;

  if (currentSection === 'users') {
    return <AdminUsersPage data={data} setData={setData} />;
  }
  if (currentSection === 'groups') {
    return <AdminGroupsPage data={data} setData={setData} />;
  }
  if (currentSection === 'expenses') {
    return <AdminExpensesPage data={data} setData={setData} />;
  }
  if (currentSection === 'settlements') {
    return <AdminSettlementsPage data={data} setData={setData} confirmSettlement={confirmSettlement} />;
  }
  if (currentSection === 'reports') {
    return <AdminReportsPage data={data} setData={setData} />;
  }
  if (currentSection === 'settings') {
    return <AdminSettingsPage data={data} setData={setData} theme={theme} setTheme={setTheme} reset={reset} onSwitchRole={onSwitchRole} />;
  }
  return <AdminOverviewPage data={data} setData={setData} />;
}
