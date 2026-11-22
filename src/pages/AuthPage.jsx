import { useState } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, UserCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function AuthPage({ mode, onAuthenticate }) {
  const navigate = useNavigate();
  const isLogin = mode === 'login';
  const [email, setEmail] = useState(isLogin ? 'aarav@splitspace.demo' : '');
  const [password, setPassword] = useState(isLogin ? 'demo1234' : '');
  const [name, setName] = useState('');

  const handleAuth = (profileEmail, profileName, isAdmin = false) => {
    const finalEmail = (profileEmail || email || (isAdmin ? 'admin@splitspace.demo' : 'aarav@splitspace.demo')).trim();
    const finalName = (profileName || name || (isAdmin ? 'System Admin' : (isLogin ? 'Aarav Mehta' : 'New Member'))).trim();
    const role = isAdmin || finalEmail.toLowerCase().includes('admin') ? 'admin' : 'user';

    onAuthenticate({
      name: finalName,
      email: finalEmail,
      role
    });

    if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const submit = (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const formEmail = String(values.get('email') || '').trim();
    const formName = String(values.get('name') || '').trim();
    const isAdmin = formEmail.toLowerCase().includes('admin');
    handleAuth(formEmail, formName, isAdmin);
  };

  const loginAsDemoUser = () => {
    setEmail('aarav@splitspace.demo');
    setPassword('demo1234');
    handleAuth('aarav@splitspace.demo', 'Aarav Mehta', false);
  };

  const loginAsDemoAdmin = () => {
    setEmail('admin@splitspace.demo');
    setPassword('admin1234');
    handleAuth('admin@splitspace.demo', 'System Admin', true);
  };

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <Link className="brand" to="/">
          <span className="brand-mark">S</span>
          <span>SPLITSPACE</span>
        </Link>
        <div>
          <p className="pill">A more thoughtful money ritual</p>
          <h1>Make space for the plans that matter.</h1>
          <ul>
            <li><CheckCircle2 size={18} /> Clear, instant balances</li>
            <li><CheckCircle2 size={18} /> Precise splitting in paise</li>
            <li><CheckCircle2 size={18} /> Transparent group management</li>
            <li><CheckCircle2 size={18} /> Built-in admin oversight portal</li>
            <li><CheckCircle2 size={18} /> Private local demo data</li>
          </ul>
        </div>
        <small>© 2026 Splitspace · Local frontend demo</small>
      </section>

      <section className="auth-form-wrap">
        <Link className="back-link" to="/">← Back to home</Link>
        <div className="auth-form">
          <p className="eyebrow">WELCOME {isLogin ? 'BACK' : 'IN'}</p>
          <h2>{isLogin ? 'Sign in to your space.' : 'Start your shared space.'}</h2>
          <p className="auth-subtitle">
            {isLogin
              ? 'Choose a demo account or sign in with your credentials.'
              : 'Create a simulated local profile for this workspace.'}
          </p>

          {isLogin && (
            <div className="demo-accounts-card" aria-label="Demo accounts section">
              <div className="demo-accounts-header">
                <LockKeyhole size={16} />
                <span><b>Instant Demo Sign-In</b> — Select a persona to test:</span>
              </div>
              <div className="demo-accounts-grid">
                <button
                  type="button"
                  className="demo-account-btn user-btn"
                  onClick={loginAsDemoUser}
                  title="Sign in as Regular Member Aarav Mehta"
                >
                  <UserCheck size={18} />
                  <div>
                    <strong>Demo User</strong>
                    <small>aarav@splitspace.demo</small>
                  </div>
                  <span className="badge soft">Member</span>
                </button>

                <button
                  type="button"
                  className="demo-account-btn admin-btn"
                  onClick={loginAsDemoAdmin}
                  title="Sign in as System Administrator"
                >
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Demo Admin</strong>
                    <small>admin@splitspace.demo</small>
                  </div>
                  <span className="badge admin-pill">Admin</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={submit} noValidate={false}>
            {!isLogin && (
              <label>
                Full name
                <input
                  required
                  name="name"
                  minLength="2"
                  maxLength="60"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </label>
            )}

            <label>
              Email address
              <input
                required
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <input
                required
                name="password"
                type="password"
                minLength="4"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            <button className="button primary wide" type="submit">
              {isLogin ? 'Enter Splitspace' : 'Create demo account'} <ArrowRight size={17} />
            </button>

            <p className="switch-auth">
              {isLogin ? 'New to Splitspace?' : 'Already have a space?'}{' '}
              <Link to={isLogin ? '/register' : '/login'}>
                {isLogin ? 'Create an account' : 'Sign in'}
              </Link>
            </p>

            <small className="auth-disclaimer">
              This is a frontend-only simulated demo. Passwords are not validated or stored externally.
            </small>
          </form>
        </div>
      </section>
    </main>
  );
}
