import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { getData, getTheme, resetData, saveData, saveTheme } from './services/store';
import {
  confirmSettlement as confirmSettlementState,
  cancelSettlement as cancelSettlementState,
  processDueRecurring,
  removeExpense as removeExpenseState,
  removeRecurringSchedule,
  setRecurringScheduleActive,
  upsertExpense,
  upsertRecurringSchedule
} from './utils/workspace';
import { Landing, InfoPage } from './pages/PublicPages';
import AuthPage from './pages/AuthPage';
import {
  AdminOverviewPage,
  AdminUsersPage,
  AdminGroupsPage,
  AdminExpensesPage,
  AdminSettlementsPage,
  AdminReportsPage,
  AdminSettingsPage
} from './pages/AdminPages';
import NotFoundPage from './pages/NotFoundPage';
import {
  ActivityPage,
  BalancesPage,
  Dashboard,
  ExpensesPage,
  GroupDetail,
  GroupsPage,
  NotificationsPage,
  SettlementsPage,
  SettingsPage
} from './pages/AppPages';

export default function App() {
  const [data, setData] = useState(() => {
    const raw = getData();
    const withRecurring = processDueRecurring(raw, new Date().toISOString().slice(0, 10), () => crypto.randomUUID());
    try {
      const session = localStorage.getItem('splitspace-session');
      if (session === 'admin@splitspace.demo') {
        const adminMember = withRecurring.members?.find((m) => m.role === 'admin') || {
          id: 'admin',
          name: 'System Admin',
          email: 'admin@splitspace.demo',
          initials: 'AD',
          role: 'admin',
          status: 'active'
        };
        return { ...withRecurring, user: adminMember };
      }
    } catch {
      /* ignore */
    }
    return withRecurring;
  });

  const [theme, setThemeState] = useState(getTheme);
  const [authenticated, setAuthenticated] = useState(() => {
    try {
      return Boolean(localStorage.getItem('splitspace-session'));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  const notify = (old, title, text, preference) =>
    old.settings?.notifications?.[preference] === false
      ? old.notifications
      : [
          {
            id: crypto.randomUUID(),
            title,
            text,
            read: false,
            date: new Date().toISOString().slice(0, 10)
          },
          ...old.notifications
        ];

  const addExpense = (expense) =>
    setData((old) => {
      if (expense.schedule) {
        return processDueRecurring(
          upsertRecurringSchedule(old, expense.schedule),
          new Date().toISOString().slice(0, 10),
          () => crypto.randomUUID()
        );
      }
      return {
        ...upsertExpense(old, expense),
        notifications: notify(
          old,
          'Expense added',
          `${expense.description} was added to your activity.`,
          'expenseUpdates'
        )
      };
    });

  const updateExpense = (expense) => setData((old) => upsertExpense(old, expense));
  const deleteExpense = (id) => setData((old) => removeExpenseState(old, id));

  const settle = (debt) =>
    setData((old) => ({
      ...old,
      settlements: [
        {
          id: crypto.randomUUID(),
          from: debt.from,
          to: debt.to,
          amount: debt.amount,
          note: debt.note || 'Direct payment',
          status: 'pending',
          date: new Date().toISOString().slice(0, 10)
        },
        ...old.settlements
      ]
    }));

  const confirmSettlement = (id) =>
    setData((old) =>
      confirmSettlementState(old, id, {
        nextId: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10)
      })
    );

  const cancelSettlement = (id) =>
    setData((old) => cancelSettlementState(old, id));

  const runRecurring = () =>
    setData((old) =>
      processDueRecurring(old, new Date().toISOString().slice(0, 10), () => crypto.randomUUID())
    );

  const updateRecurring = (schedule) =>
    setData((old) =>
      processDueRecurring(
        upsertRecurringSchedule(old, schedule),
        new Date().toISOString().slice(0, 10),
        () => crypto.randomUUID()
      )
    );

  const toggleRecurring = (id, active) =>
    setData((old) => {
      const updated = setRecurringScheduleActive(old, id, active);
      return active
        ? processDueRecurring(updated, new Date().toISOString().slice(0, 10), () => crypto.randomUUID())
        : updated;
    });

  const deleteRecurring = (id) => setData((old) => removeRecurringSchedule(old, id));

  const saveProfile = (user) => {
    const initials = user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
    const updatedUser = { ...user, initials };
    setData((old) => ({
      ...old,
      user: updatedUser,
      members: (old.members || []).map((member) =>
        member.id === user.id ? { ...member, ...updatedUser } : member
      )
    }));
  };

  const switchRole = (newRole) => {
    if (newRole === 'admin') {
      const adminMember = data.members?.find((m) => m.role === 'admin') || {
        id: 'admin',
        name: 'System Admin',
        email: 'admin@splitspace.demo',
        initials: 'AD',
        role: 'admin',
        status: 'active'
      };
      try {
        localStorage.setItem('splitspace-session', 'admin@splitspace.demo');
      } catch {
        /* Local session only */
      }
      setData((old) => ({ ...old, user: adminMember }));
    } else {
      const userMember = data.members?.find((m) => m.id === 'me') || data.members?.[0] || {
        id: 'me',
        name: 'Aarav Mehta',
        email: 'aarav@splitspace.demo',
        initials: 'AM',
        role: 'user',
        status: 'active'
      };
      try {
        localStorage.setItem('splitspace-session', 'aarav@splitspace.demo');
      } catch {
        /* Local session only */
      }
      setData((old) => ({ ...old, user: userMember }));
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('splitspace-session');
    } catch {
      /* Local session only */
    }
    setAuthenticated(false);
  };

  const authenticate = (profile) => {
    const sessionEmail = profile.email || 'aarav@splitspace.demo';
    try {
      localStorage.setItem('splitspace-session', sessionEmail);
    } catch {
      /* Local session only */
    }
    setAuthenticated(true);

    if (profile.role === 'admin' || sessionEmail.toLowerCase().includes('admin')) {
      const adminMember = data.members?.find((m) => m.role === 'admin') || {
        id: 'admin',
        name: profile.name || 'System Admin',
        email: sessionEmail,
        initials: 'AD',
        role: 'admin',
        status: 'active'
      };
      setData((old) => ({ ...old, user: adminMember }));
    } else {
      const userMember = data.members?.find((m) => m.id === 'me') || data.members?.[0] || {
        id: 'me',
        name: profile.name || 'Aarav Mehta',
        email: sessionEmail,
        initials: 'AM',
        role: 'user',
        status: 'active'
      };
      const updatedUser = {
        ...userMember,
        name: profile.name || userMember.name,
        email: profile.email || userMember.email,
        role: 'user'
      };
      saveProfile(updatedUser);
    }
  };

  const reset = () => {
    if (window.confirm('Reset all local Splitspace demo data?')) {
      setData(resetData());
    }
  };

  const unread = data.notifications.filter((note) => !note.read).length;

  const shell = (content) =>
    authenticated ? (
      <AppShell
        data={data}
        unread={unread}
        theme={theme}
        setTheme={setThemeState}
        onSwitchRole={switchRole}
        logout={logout}
      >
        {content}
      </AppShell>
    ) : (
      <Navigate to="/login" replace />
    );

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/features" element={<InfoPage type="features" />} />
      <Route path="/about" element={<InfoPage type="about" />} />
      <Route path="/login" element={<AuthPage mode="login" onAuthenticate={authenticate} />} />
      <Route path="/register" element={<AuthPage mode="register" onAuthenticate={authenticate} />} />

      {/* User Workspace Routes */}
      <Route path="/dashboard" element={shell(<Dashboard data={data} addExpense={addExpense} />)} />
      <Route path="/groups" element={shell(<GroupsPage data={data} setData={setData} />)} />
      <Route
        path="/groups/:id"
        element={
          shell(
            <GroupDetail
              data={data}
              setData={setData}
              addExpense={addExpense}
              updateExpense={updateExpense}
              onDelete={deleteExpense}
              settle={settle}
              confirmSettlement={confirmSettlement}
              cancelSettlement={cancelSettlement}
            />
          )
        }
      />
      <Route
        path="/expenses"
        element={
          shell(
            <ExpensesPage
              data={data}
              addExpense={addExpense}
              updateExpense={updateExpense}
              onDelete={deleteExpense}
              runRecurring={runRecurring}
              updateRecurring={updateRecurring}
              toggleRecurring={toggleRecurring}
              deleteRecurring={deleteRecurring}
            />
          )
        }
      />
      <Route path="/balances" element={shell(<BalancesPage data={data} settle={settle} />)} />
      <Route
        path="/settlements"
        element={
          shell(
            <SettlementsPage
              data={data}
              confirmSettlement={confirmSettlement}
              cancelSettlement={cancelSettlement}
              settle={settle}
            />
          )
        }
      />
      <Route path="/activity" element={shell(<ActivityPage data={data} />)} />
      <Route
        path="/notifications"
        element={shell(<NotificationsPage data={data} setData={setData} />)}
      />
      <Route
        path="/settings"
        element={
          shell(
            <SettingsPage
              data={data}
              setData={setData}
              theme={theme}
              setTheme={setThemeState}
              reset={reset}
              logout={logout}
              saveProfile={saveProfile}
              onSwitchRole={switchRole}
            />
          )
        }
      />

      {/* Admin Console Routes */}
      <Route
        path="/admin"
        element={shell(<AdminOverviewPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/users"
        element={shell(<AdminUsersPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/groups"
        element={shell(<AdminGroupsPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/expenses"
        element={shell(<AdminExpensesPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/settlements"
        element={
          shell(
            <AdminSettlementsPage
              data={data}
              setData={setData}
              confirmSettlement={confirmSettlement}
              cancelSettlement={cancelSettlement}
            />
          )
        }
      />
      <Route
        path="/admin/reports"
        element={shell(<AdminReportsPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/settings"
        element={
          shell(
            <AdminSettingsPage
              data={data}
              setData={setData}
              theme={theme}
              setTheme={setThemeState}
              reset={reset}
              onSwitchRole={switchRole}
            />
          )
        }
      />

      {/* 404 Not Found Page */}
      <Route path="/404" element={shell(<NotFoundPage role={data.user?.role || 'user'} />)} />
      <Route path="*" element={shell(<NotFoundPage role={data.user?.role || 'user'} />)} />
    </Routes>
  );
}
