import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Mail,
  User
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import DemoAccountsExpandable from '../components/auth/DemoAccountsExpandable';
import PasswordInput from '../components/auth/PasswordInput';
import { findUserByEmail, registerUser } from '../services/store';

export default function AuthPage({ mode = 'login', onAuthenticate }) {
  const navigate = useNavigate();
  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';

  const [name, setName] = useState('');
  const [email, setEmail] = useState(isLogin ? 'aarav@splitspace.demo' : '');
  const [password, setPassword] = useState(isLogin ? 'demo1234' : '');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading] = useState(false);

  // Password strength calculation for registration
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' };
    if (score === 2) return { score: 2, label: 'Fair', color: '#f59e0b' };
    if (score === 3 || score === 4) return { score: 3, label: 'Good', color: '#3b82f6' };
    return { score: 4, label: 'Strong', color: '#10b981' };
  }, [password]);

  const handleInstantDemo = (type) => {
    setError('');
    if (type === 'admin') {
      onAuthenticate({
        id: 'admin',
        name: 'System Admin',
        email: 'admin@splitspace.demo',
        role: 'admin',
        initials: 'AD'
      });
      navigate('/admin');
    } else {
      onAuthenticate({
        id: 'me',
        name: 'Aarav Mehta',
        email: 'aarav@splitspace.demo',
        role: 'user',
        initials: 'AM'
      });
      navigate('/dashboard');
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const formData = new FormData(form);
    const cleanEmail = String(formData.get('email') || email || '').trim().toLowerCase();
    const cleanPassword = String(formData.get('password') || password || '').trim();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!cleanPassword) {
      setError('Please enter your password.');
      return;
    }

    // Check admin account
    if (cleanEmail === 'admin@splitspace.demo') {
      onAuthenticate({
        id: 'admin',
        name: 'System Admin',
        email: 'admin@splitspace.demo',
        role: 'admin',
        initials: 'AD'
      });
      navigate('/admin');
      return;
    }

    // Check demo user
    if (cleanEmail === 'aarav@splitspace.demo') {
      onAuthenticate({
        id: 'me',
        name: 'Aarav Mehta',
        email: 'aarav@splitspace.demo',
        role: 'user',
        initials: 'AM'
      });
      navigate('/dashboard');
      return;
    }

    // Look up in registered users
    const existing = findUserByEmail(cleanEmail);
    if (existing) {
      onAuthenticate({
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: existing.role || 'user',
        initials: existing.initials || 'U'
      });
      navigate(existing.role === 'admin' ? '/admin' : '/dashboard');
    } else {
      // Default fallback
      onAuthenticate({
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        role: 'user'
      });
      navigate('/dashboard');
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    const cleanName = String(formData.get('name') || name || '').trim();
    const cleanEmail = String(formData.get('email') || email || '').trim().toLowerCase();
    const cleanPassword = String(formData.get('password') || password || '');
    const cleanConfirm = String(formData.get('confirmPassword') || confirmPassword || '');

    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your full name (minimum 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (cleanConfirm && cleanPassword !== cleanConfirm) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    const result = registerUser({
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword
    });

    if (!result.success) {
      setError(result.error);
      return;
    }

    onAuthenticate(result.user);
    navigate('/dashboard');
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const formData = new FormData(form);
    const cleanEmail = String(formData.get('email') || email || '').trim().toLowerCase();

    if (!cleanEmail) {
      setError('Please enter your registered email address.');
      return;
    }

    setSuccessMsg(
      `Password reset instructions simulated for ${cleanEmail}. In this local browser demo, you may log in directly with any credentials or select a demo account.`
    );
  };

  return (
    <main className="auth-page-container">
      {/* Left Column: Brand Showcase Panel */}
      <AuthBrandPanel />

      {/* Right Column: Authentication Form Card */}
      <section className="auth-form-column" aria-label="Authentication form">
        <div className="auth-top-navigation">
          <Link className="back-home-link" to="/">
            ← Back to home
          </Link>
        </div>

        <div className="auth-form-card">
          <div className="auth-form-header">
            <p className="auth-eyebrow">
              {isLogin ? 'WELCOME BACK' : isRegister ? 'START FRESH' : 'ACCOUNT RECOVERY'}
            </p>
            <h2>
              {isLogin
                ? 'Sign in to your space.'
                : isRegister
                ? 'Create your workspace'
                : 'Reset your password'}
            </h2>
            <p className="auth-subtitle">
              {isLogin
                ? 'Choose an instant demo persona or sign in with your credentials.'
                : isRegister
                ? 'Get a completely independent, blank workspace for your personal shared finances.'
                : 'Enter your registered email to simulate password recovery.'}
            </p>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="auth-alert error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert success" role="status">
              <CheckCircle2 size={17} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Demo account quick login on Login mode */}
          {isLogin && <DemoAccountsExpandable onSelectDemo={handleInstantDemo} />}

          {/* Login Form */}
          {isLogin && (
            <form onSubmit={handleLoginSubmit} className="auth-actual-form" noValidate>
              <div className="auth-field-group">
                <label htmlFor="login-email">Email address</label>
                <div className="auth-input-icon-wrap">
                  <div className="input-icon">
                    <Mail size={16} />
                  </div>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <div className="field-label-row">
                  <label htmlFor="login-password">Password</label>
                  <Link to="/forgot-password" className="forgot-password-link">
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="login-password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                className="button primary wide auth-submit-btn"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Entering SplitSpace…' : 'Enter SplitSpace'}{' '}
                <ArrowRight size={17} />
              </button>

              <div className="switch-auth-mode">
                <span>New to SplitSpace?</span>{' '}
                <Link to="/register" className="switch-auth-link">
                  Create an account
                </Link>
              </div>
            </form>
          )}

          {/* Register Form */}
          {isRegister && (
            <form onSubmit={handleRegisterSubmit} className="auth-actual-form" noValidate>
              <div className="auth-field-group">
                <label htmlFor="register-name">Full name</label>
                <div className="auth-input-icon-wrap">
                  <div className="input-icon">
                    <User size={16} />
                  </div>
                  <input
                    id="register-name"
                    name="name"
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vinayak Padalti"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label htmlFor="register-email">Email address</label>
                <div className="auth-input-icon-wrap">
                  <div className="input-icon">
                    <Mail size={16} />
                  </div>
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vinayak@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label htmlFor="register-password">Password</label>
                <PasswordInput
                  id="register-password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  required
                  minLength={4}
                  autoComplete="new-password"
                />

                {/* Password strength meter */}
                {password && (
                  <div className="password-strength-meter" aria-live="polite">
                    <div className="strength-bars">
                      {[1, 2, 3, 4].map((level) => (
                        <span
                          key={level}
                          className={`strength-bar ${
                            level <= passwordStrength.score ? 'active' : ''
                          }`}
                          style={{
                            backgroundColor:
                              level <= passwordStrength.score
                                ? passwordStrength.color
                                : undefined
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="strength-label"
                      style={{ color: passwordStrength.color }}
                    >
                      {passwordStrength.label} password
                    </span>
                  </div>
                )}
              </div>

              <div className="auth-field-group">
                <label htmlFor="register-confirm-password">Confirm password</label>
                <PasswordInput
                  id="register-confirm-password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required={false}
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>

              <div className="data-isolation-callout">
                <CheckCircle2 size={15} />
                <span>
                  <strong>Guaranteed Data Isolation:</strong> Your new workspace starts with 0
                  groups, 0 expenses, and ₹0 balances. No demo data is shared.
                </span>
              </div>

              <button
                className="button primary wide auth-submit-btn"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Creating workspace…' : 'Create Isolated Account'}{' '}
                <ArrowRight size={17} />
              </button>

              <div className="switch-auth-mode">
                <span>Already have a space?</span>{' '}
                <Link to="/login" className="switch-auth-link">
                  Sign in
                </Link>
              </div>
            </form>
          )}

          {/* Forgot Password Form */}
          {isForgot && (
            <form onSubmit={handleForgotSubmit} className="auth-actual-form" noValidate>
              <div className="auth-field-group">
                <label htmlFor="forgot-email">Registered email address</label>
                <div className="auth-input-icon-wrap">
                  <div className="input-icon">
                    <Mail size={16} />
                  </div>
                  <input
                    id="forgot-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                className="button primary wide auth-submit-btn"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Sending link…' : 'Send Reset Instructions'}{' '}
                <ArrowRight size={17} />
              </button>

              <div className="switch-auth-mode">
                <span>Remember your password?</span>{' '}
                <Link to="/login" className="switch-auth-link">
                  Sign in
                </Link>
              </div>
            </form>
          )}

          <p className="auth-disclaimer">
            This is a frontend fintech application running in local browser storage.
            Passwords and records are stored safely in your browser session.
          </p>
        </div>
      </section>
    </main>
  );
}
