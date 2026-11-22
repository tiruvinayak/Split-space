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
    let session;
    try {
      session = localStorage.getItem('splitspace-session');
    } catch {
      session = null;
    }
    const raw = getData(session);
    return processDueRecurring(raw, new Date().toISOString().slice(0, 10), () => crypto.randomUUID());
  });

  const [theme, setThemeState] = useState(getTheme);
  const [authenticated, setAuthenticated] = useState(() => {
    try {
      return Boolean(localStorage.getItem('splitspace-session'));
    } catch {
      return false;
    }
  });

  // Strict Admin Access check: ONLY the predefined Demo Admin possesses admin authority
  const isAdmin = Boolean(
    authenticated &&
      (data.user?.email === 'admin@splitspace.demo' || data.user?.role === 'admin')
  );

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

  const switchRole = (targetSection) => {
    if (!isAdmin) return;
    // Demo admin toggling between admin portal and user workspace
    if (targetSection === 'admin') {
      try {
        localStorage.setItem('splitspace-session', 'admin@splitspace.demo');
      } catch {
        /* ignore */
      }
      setData((old) => {
        const adminMember = old.members?.find((m) => m.role === 'admin') || {
          id: 'admin',
          name: 'System Admin',
          email: 'admin@splitspace.demo',
          initials: 'AD',
          role: 'admin',
          status: 'active'
        };
        return { ...old, user: adminMember };
      });
    } else {
      // Admin looking at user perspective
      setData((old) => ({ ...old }));
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('splitspace-session');
    } catch {
      /* ignore */
    }
    setAuthenticated(false);
  };

  const authenticate = (profile) => {
    const sessionEmail = profile.email || 'aarav@splitspace.demo';
    try {
      localStorage.setItem('splitspace-session', sessionEmail);
    } catch {
      /* ignore */
    }
    setAuthenticated(true);

    // Retrieve the user's isolated workspace!
    const userWorkspace = getData(sessionEmail);
    const withRecurring = processDueRecurring(
      userWorkspace,
      new Date().toISOString().slice(0, 10),
      () => crypto.randomUUID()
    );
    setData(withRecurring);
  };

  const reset = () => {
    if (window.confirm('Reset current SplitSpace local workspace data?')) {
      const activeEmail = data.user?.email || localStorage.getItem('splitspace-session');
      setData(resetData(activeEmail));
    }
  };

  const unread = data.notifications.filter((note) => !note.read).length;

  // Protected User Workspace Shell: Redirects to /login if unauthenticated
  const userShell = (content) =>
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

  // Protected Admin Shell: Strictly restricted to Demo Admin account!
  // If not authenticated -> /login
  // If authenticated but not admin -> /dashboard
  const adminShell = (content) => {
    if (!authenticated) {
      return <Navigate to="/login" replace />;
    }
    if (!isAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
    return (
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
    );
  };

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/features" element={<InfoPage type="features" />} />
      <Route path="/about" element={<InfoPage type="about" />} />
      <Route path="/login" element={<AuthPage mode="login" onAuthenticate={authenticate} />} />
      <Route path="/register" element={<AuthPage mode="register" onAuthenticate={authenticate} />} />
      <Route path="/forgot-password" element={<AuthPage mode="forgot" onAuthenticate={authenticate} />} />

      {/* User Workspace Routes */}
      <Route path="/dashboard" element={userShell(<Dashboard data={data} addExpense={addExpense} />)} />
      <Route path="/groups" element={userShell(<GroupsPage data={data} setData={setData} />)} />
      <Route
        path="/groups/:id"
        element={
          userShell(
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
          userShell(
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
      <Route path="/balances" element={userShell(<BalancesPage data={data} settle={settle} />)} />
      <Route
        path="/settlements"
        element={
          userShell(
            <SettlementsPage
              data={data}
              confirmSettlement={confirmSettlement}
              cancelSettlement={cancelSettlement}
              settle={settle}
            />
          )
        }
      />
      <Route path="/activity" element={userShell(<ActivityPage data={data} />)} />
      <Route
        path="/notifications"
        element={userShell(<NotificationsPage data={data} setData={setData} />)}
      />
      <Route
        path="/settings"
        element={
          userShell(
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

      {/* Admin Console Routes (Exclusively for Demo Admin) */}
      <Route
        path="/admin"
        element={adminShell(<AdminOverviewPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/users"
        element={adminShell(<AdminUsersPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/groups"
        element={adminShell(<AdminGroupsPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/expenses"
        element={adminShell(<AdminExpensesPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/settlements"
        element={
          adminShell(
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
        element={adminShell(<AdminReportsPage data={data} setData={setData} />)}
      />
      <Route
        path="/admin/settings"
        element={
          adminShell(
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
      <Route path="/404" element={userShell(<NotFoundPage role={data.user?.role || 'user'} />)} />
      <Route path="*" element={userShell(<NotFoundPage role={data.user?.role || 'user'} />)} />
    </Routes>
  );
}
