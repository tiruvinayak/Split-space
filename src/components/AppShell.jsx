import { useState, useSyncExternalStore } from 'react';
import {
  Bell,
  Handshake,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  WalletCards,
  X,
  FileSpreadsheet,
  ArrowLeftRight
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { getStorageWarning, subscribeStorageWarning } from '../services/store';

const userNav = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/groups', label: 'My Groups', icon: Users },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText },
  { to: '/balances', label: 'Balances', icon: WalletCards },
  { to: '/settlements', label: 'Settlements', icon: Handshake },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const adminNav = [
  { to: '/admin', label: 'Admin Overview', icon: ShieldCheck, exact: true },
  { to: '/admin/users', label: 'User Management', icon: Users },
  { to: '/admin/groups', label: 'Group Management', icon: Layers },
  { to: '/admin/expenses', label: 'Expense Monitoring', icon: ReceiptText },
  { to: '/admin/settlements', label: 'Settlements', icon: Handshake },
  { to: '/admin/reports', label: 'Reports', icon: FileSpreadsheet },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ children, data, unread = 0, theme, setTheme, onSwitchRole, logout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const storageWarning = useSyncExternalStore(subscribeStorageWarning, getStorageWarning, getStorageWarning);

  // Strict Demo Admin Access Control:
  // Only the predefined Demo Admin account (admin@splitspace.demo) possesses admin privileges
  const isAdmin = Boolean(
    data.user?.email === 'admin@splitspace.demo' || data.user?.role === 'admin'
  );

  const isAdminSection = location.pathname.startsWith('/admin');
  const showAdminNav = isAdmin && isAdminSection;
  const currentNav = showAdminNav ? adminNav : userNav;

  const currentNavItem = currentNav.find((item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  const title = currentNavItem?.label
    || (location.pathname.startsWith('/groups/') ? 'Group Details'
    : location.pathname.includes('notifications') ? 'Notifications'
    : location.pathname.includes('admin') ? 'Admin Console'
    : 'Settings');

  const closeNav = () => setOpen(false);

  const toggleRole = () => {
    if (!isAdmin) return;
    closeNav();
    const nextSection = showAdminNav ? 'user' : 'admin';
    if (onSwitchRole) {
      onSwitchRole(nextSection);
    }
    navigate(nextSection === 'admin' ? '/admin' : '/dashboard');
  };

  const handleLogout = () => {
    closeNav();
    if (logout) {
      logout();
    } else {
      try { localStorage.removeItem('splitspace-session'); } catch { /* Session is local-only */ }
      navigate('/login');
    }
  };

  return (
    <div className={`app-shell ${showAdminNav ? 'admin-mode' : ''}`}>
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-top">
          <Link className="brand" to={showAdminNav ? '/admin' : '/dashboard'} onClick={closeNav}>
            <span className="brand-mark">{showAdminNav ? '⚡' : 'S'}</span>
            <span>{showAdminNav ? 'SPLITSPACE ADMIN' : 'SPLITSPACE'}</span>
          </Link>

          {/* Role badge and switcher: STRICTLY restricted to Demo Admin account */}
          <div className="role-indicator-badge">
            <span className={`role-pill ${showAdminNav ? 'admin' : 'user'}`}>
              {showAdminNav ? 'Admin Portal' : 'Member Workspace'}
            </span>
            {isAdmin && (
              <button
                type="button"
                className="role-switch-btn"
                onClick={toggleRole}
                title={`Switch to ${showAdminNav ? 'User Workspace' : 'Admin Portal'}`}
              >
                <ArrowLeftRight size={13} />
                <span>{showAdminNav ? 'Switch to User' : 'Switch to Admin'}</span>
              </button>
            )}
          </div>
        </div>

        <nav aria-label={showAdminNav ? 'Admin navigation' : 'User navigation'}>
          {currentNav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              onClick={closeNav}
              key={to}
              to={to}
              end={Boolean(exact)}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Icon size={18} />
              <span>{label}</span>
              {to === '/notifications' && unread > 0 && (
                <span className="nav-count" aria-label={`${unread} unread notifications`}>{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {/* Admin console link in sidebar: ONLY rendered if user is Admin */}
          {isAdmin && !showAdminNav && (
            <NavLink onClick={closeNav} to="/admin" className="admin-demo-link">
              <ShieldCheck size={18} />
              <span>Admin Console</span>
              <span className="mini-badge">Admin</span>
            </NavLink>
          )}

          <div className="user-profile-card">
            <div className="user-profile-info">
              <Avatar member={data.user} small />
              <div className="user-profile-meta">
                <strong>{data.user.name}</strong>
                <small>{data.user.email || 'Local user'}</small>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Log out of SplitSpace"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={closeNav}
        />
      )}

      <main className="main-viewport">
        <header className="topbar">
          <div className="topbar-left">
            <button
              aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={open}
              className="icon-button mobile-menu"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <p className="eyebrow">{showAdminNav ? 'ADMIN CONSOLE' : 'WORKSPACE'} / {title}</p>
              <h1>{title}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            {isAdmin ? (
              <button
                type="button"
                className="topbar-role-pill"
                onClick={toggleRole}
                title={`Click to switch to ${showAdminNav ? 'User Workspace' : 'Admin Console'}`}
              >
                <span className={`status-dot ${showAdminNav ? 'admin' : 'user'}`} />
                <span>{showAdminNav ? 'Admin' : 'User'}</span>
              </button>
            ) : (
              <span className="topbar-member-badge">
                <span className="status-dot user" />
                <span>Member</span>
              </span>
            )}

            <button
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="icon-button theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <Link
              className="icon-button notification-button"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              to="/notifications"
              title="Notifications"
            >
              <Bell size={19} />
              {unread > 0 && <i>{unread}</i>}
            </Link>

            <Link
              className="profile-button"
              to={showAdminNav ? '/admin/settings' : '/settings'}
              aria-label={`Profile and settings for ${data.user.name}`}
            >
              <Avatar member={data.user} small />
              <span>{data.user.name.split(' ')[0]}</span>
            </Link>
          </div>
        </header>

        {storageWarning && (
          <div className="storage-warning" role="alert">
            {storageWarning}
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
