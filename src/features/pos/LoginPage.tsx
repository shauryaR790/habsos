import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { clearStaffSession, hasStaffSession, markStaffSession } from './staffSession';

/** Demo counter PIN — signs in as the seeded staff user (see server env defaults). */
const DEMO_PIN = '2580';
const DEMO_EMAIL = 'admin@habs.cafe';
const DEMO_PASSWORD = 'habsos-admin';

export function LoginPage() {
  useTitle('Point of Sale');
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        await api<{ user: { id: string } }>('/api/auth/me');
        if (cancel) return;
        markStaffSession();
        navigate('/pos', { replace: true });
      } catch {
        if (cancel) return;
        if (hasStaffSession()) clearStaffSession();
        setChecking(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [navigate]);

  async function loginWith(emailValue: string, passwordValue: string) {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: emailValue, password: passwordValue }) });
    markStaffSession();
    navigate('/pos', { replace: true });
  }

  async function submitPin(event: FormEvent) {
    event.preventDefault();
    if (pin.length < 4) {
      setError('Enter your 4-digit PIN.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (pin === DEMO_PIN) {
        await loginWith(DEMO_EMAIL, DEMO_PASSWORD);
        return;
      }
      setError('Wrong PIN. Use 2580 for the demo register.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginWith(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="odoo-pos o-login">
        <div className="o-login__card o-login__card--busy">
          <img src="/ui/pos-awning.png" alt="" className="o-login__logo" width={48} height={44} />
          <div className="o-loading-bar"><span /></div>
          <p>Opening Point of Sale…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="odoo-pos o-login">
      <form className="o-login__card" onSubmit={(event) => void submitPin(event)}>
        <div className="o-login__brand">
          <img src="/ui/pos-awning.png" alt="" className="o-login__logo" width={48} height={44} />
          <div>
            <p className="o-login__eyebrow">Point of Sale</p>
            <h1>Sign in</h1>
          </div>
        </div>
        <p className="o-login__hint">Demo PIN for staff sign-in</p>
        <label className="o-login__field">
          <span>PIN</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            maxLength={6}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••"
          />
        </label>
        {error ? <p className="o-login__error" role="alert">{error}</p> : null}
        <button type="submit" className="o-btn o-btn--primary o-login__submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Opening register…' : 'Enter register'}
        </button>
        <button type="button" className="o-login__toggle" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? 'Hide email sign-in' : 'Email & password instead'}
        </button>
      </form>

      {showAdvanced ? (
        <form className="o-login__card o-login__card--advanced" onSubmit={(event) => void submitEmail(event)}>
          <label className="o-login__field">
            <span>Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="o-login__field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" className="o-btn o-login__submit" disabled={busy}>
            Sign in with email
          </button>
        </form>
      ) : null}

      <p className="o-login__foot">
        First sign-in needs internet. After that, the register works offline.
      </p>
    </main>
  );
}
