import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

export function LoginPage() {
  useTitle('Staff sign in');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      navigate('/pos', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">After Dunes</p>
        <h1>Staff</h1>
        <Input label="Email" type="email" autoComplete="username" value={email} required onChange={(event) => setEmail(event.target.value)} />
        <Input label="Password" type="password" autoComplete="current-password" value={password} required onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <Button type="submit" full disabled={busy} aria-busy={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        <p className="fine">The first sign-in on a device needs a connection. After that, the register keeps working offline.</p>
      </form>
    </main>
  );
}
