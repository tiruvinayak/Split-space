import { useState } from 'react';
import { ChevronDown, ChevronUp, LockKeyhole, ShieldCheck, UserCheck } from 'lucide-react';

export default function DemoAccountsExpandable({ onSelectDemo }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="demo-accounts-card" aria-label="Demo accounts section">
      <div
        className="demo-accounts-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        style={{ cursor: 'pointer' }}
      >
        <div className="header-left">
          <LockKeyhole size={15} />
          <span><b>Instant Demo Sign-In</b> — Select a persona to test:</span>
        </div>
        <button
          type="button"
          className="demo-expand-toggle"
          aria-label={expanded ? 'Collapse demo accounts' : 'Expand demo accounts'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="demo-accounts-grid">
          <button
            type="button"
            className="demo-account-btn user-btn"
            onClick={() => onSelectDemo('user')}
            title="Sign in as Regular Member Aarav Mehta"
          >
            <UserCheck size={18} />
            <div className="demo-btn-text">
              <strong>Demo User</strong>
              <small>aarav@splitspace.demo</small>
            </div>
            <span className="badge soft">Member</span>
          </button>

          <button
            type="button"
            className="demo-account-btn admin-btn"
            onClick={() => onSelectDemo('admin')}
            title="Sign in as System Administrator"
          >
            <ShieldCheck size={18} />
            <div className="demo-btn-text">
              <strong>Demo Admin</strong>
              <small>admin@splitspace.demo</small>
            </div>
            <span className="badge admin-pill">Admin</span>
          </button>
        </div>
      )}
    </div>
  );
}
