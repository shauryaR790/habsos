import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { get, run } from './db';
import { env, isProduction } from './env';

const scryptAsync = promisify(scrypt);
const SESSION_MS = 16 * 60 * 60 * 1000;

type SessionUser = { id: string; name: string; email: string; role: string };

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hex] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hex) return false;
  const derived = (await scryptAsync(password, salt, 32)) as Buffer;
  const actual = Buffer.from(hex, 'hex');
  if (actual.length !== derived.length) return false;
  return timingSafeEqual(actual, derived);
}

function sign(body: string) {
  return createHmac('sha256', env.sessionSecret).update(body).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function loadUser(userId: string): SessionUser | null {
  const row = get<SessionUser>('SELECT id, name, email, role FROM users WHERE id = ?', [userId]);
  return row ?? null;
}

/** Stateless signed cookie — survives Vercel cold starts / Blob DB races. */
export function createSession(userId: string) {
  const exp = Date.now() + SESSION_MS;
  const body = `v1.${userId}.${exp}`;
  const id = `${body}.${sign(body)}`;
  const now = new Date().toISOString();
  try {
    run(
      'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [`sig_${userId}_${exp}`, userId, new Date(exp).toISOString(), now],
    );
  } catch {
    /* audit row optional */
  }
  return { id, maxAge: Math.floor(SESSION_MS / 1000) };
}

export function destroySession(id: string) {
  try {
    run('DELETE FROM sessions WHERE id = ?', [id]);
  } catch {
    /* ignore */
  }
  const parsed = parseSigned(id);
  if (parsed) {
    try {
      run('DELETE FROM sessions WHERE user_id = ? AND id LIKE ?', [parsed.userId, 'sig_%']);
    } catch {
      /* ignore */
    }
  }
}

function parseSigned(token: string): { userId: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const [, userId, expStr, sig] = parts;
  if (!userId || !expStr || !sig) return null;
  const body = `v1.${userId}.${expStr}`;
  if (!safeEqual(sign(body), sig)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return { userId, exp };
}

function legacySessionUser(token: string): SessionUser | null {
  const row = get<{ id: string; name: string; email: string; role: string; expires_at: string }>(
    `SELECT u.id, u.name, u.email, u.role, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [token],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export function getSessionUser(token: string): SessionUser | null {
  const signed = parseSigned(token);
  if (signed) return loadUser(signed.userId);
  return legacySessionUser(token);
}

/** Keep an active register signed in for the full shift window. */
export function touchSession(token: string): { user: SessionUser; token: string; maxAge: number } | null {
  const user = getSessionUser(token);
  if (!user) return null;
  const next = createSession(user.id);
  return { user, token: next.id, maxAge: next.maxAge };
}

export function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return null;
}

export function sessionCookie(token: string, maxAge: number) {
  const secure = isProduction() ? '; Secure' : '';
  return `habsos_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  const secure = isProduction() ? '; Secure' : '';
  return `habsos_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
