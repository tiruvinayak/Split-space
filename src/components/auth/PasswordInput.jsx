import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function PasswordInput({
  id,
  name = 'password',
  value,
  onChange,
  placeholder = '••••••••',
  required = true,
  minLength = 4,
  autoComplete = 'current-password',
  ariaLabel = 'Password',
  disabled = false
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="password-input-wrapper">
      <div className="password-input-icon">
        <Lock size={16} />
      </div>
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        disabled={disabled}
        className="password-field-input"
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        tabIndex={0}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
