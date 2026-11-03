import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingState } from '../../components/LoadingState';
import { clearStaffSession, hasStaffSession, markStaffSession } from './staffSession';

/** Demo counter PIN — signs in as the seeded staff user (see server env defaults). */
const DEMO_PIN = '2580';
const DEMO_EMAIL = 'admin@habs.cafe';
const DEMO_PASSWORD = 'habsos-admin';

export function LoginPage() {
  useTitle('Staff sign in');
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
      <main className="login">
        <LoadingState label="Opening register" />
      </main>
    );
  }

  return (
    <main className="login">
      <form className="login-pin" onSubmit={(event) => void submitPin(event)}>
        <p className="eyebrow">After Dunes</p>
        <h1>Register</h1>
        <p className="login-demo-hint">Demo PIN for staff sign-in</p>
        <Input
          label="PIN"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          maxLength={6}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••"
        />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <Button type="submit" full disabled={busy} aria-busy={busy}>
          {busy ? 'Opening register…' : 'Enter register'}
        </Button>
        <button type="button" className="login-advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? 'Hide email sign-in' : 'Email & password instead'}
        </button>
      </form>

      {showAdvanced ? (
        <form className="login-advanced" onSubmit={(event) => void submitEmail(event)}>
          <Input label="Email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button type="submit" variant="ghost" full disabled={busy}>
            Sign in with email
          </Button>
        </form>
      ) : null}

      <p className="fine login-foot">
        First sign-in needs internet. After that, the register works offline.
      </p>
    </main>
  );
}
