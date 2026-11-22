import { Calculator, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AuthBrandPanel() {
  return (
    <aside className="auth-brand-panel" aria-label="SplitSpace Brand Overview">
      <div className="auth-brand-top">
        <Link className="auth-brand-logo" to="/">
          <span className="brand-mark-symbol">S</span>
          <span className="brand-text">SPLITSPACE</span>
        </Link>
        <span className="brand-tagline-pill">
          <Sparkles size={13} />
          <span>Fintech-grade Expense Sharing</span>
        </span>
      </div>

      <div className="auth-brand-center">
        <h1 className="auth-brand-headline">
          Shared expenses.<br />
          <span>Clear relationships.</span>
        </h1>
        <p className="auth-brand-subheadline">
          Bring your groups, expenses and balances together in one simple workspace.
        </p>

        <div className="auth-features-list">
          <div className="auth-feature-item">
            <div className="feature-item-icon">
              <Calculator size={18} />
            </div>
            <div>
              <strong>Instant Fair Calculations</strong>
              <p>Exact paise-level integer precision with zero rounding disputes.</p>
            </div>
          </div>

          <div className="auth-feature-item">
            <div className="feature-item-icon">
              <TrendingUp size={18} />
            </div>
            <div>
              <strong>Full Visibility & Control</strong>
              <p>Transparent group ledgers, receipt proof, and graph-simplified settlements.</p>
            </div>
          </div>

          <div className="auth-feature-item">
            <div className="feature-item-icon">
              <ShieldCheck size={18} />
            </div>
            <div>
              <strong>Private Local Workspace</strong>
              <p>Your financial records stay isolated and securely stored in your browser.</p>
            </div>
          </div>
        </div>

        {/* Abstract Fintech CSS Visual Card */}
        <div className="auth-css-fintech-card" aria-hidden="true">
          <div className="fintech-card-header">
            <div className="fintech-avatar-group">
              <span className="mini-avatar av-1">AM</span>
              <span className="mini-avatar av-2">MK</span>
              <span className="mini-avatar av-3">LR</span>
              <span className="mini-avatar av-4">+1</span>
            </div>
            <span className="fintech-status-badge">✦ All Settled</span>
          </div>
          <div className="fintech-card-content">
            <div className="fintech-amount-row">
              <small>Weekend Trip to Goa</small>
              <b>₹8,400.00</b>
            </div>
            <div className="fintech-progress-bar">
              <span className="progress-fill" style={{ width: '100%' }} />
            </div>
            <div className="fintech-breakdown-row">
              <span>Paid by You: ₹8,400</span>
              <span className="green-highlight">+₹6,300 owed to you</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-brand-footer">
        <small>© 2026 SplitSpace · High-fidelity local fintech architecture</small>
      </div>
    </aside>
  );
}
