import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { get, run } from './db';
import { isProduction } from './env';

const scryptAsync = promisify(scrypt);
const SESSION_MS = 16 * 60 * 60 * 1000;

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

export function createSession(userId: string) {
  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MS).toISOString();
  run('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [id, userId, expires, now.toISOString()]);
  return { id, maxAge: Math.floor(SESSION_MS / 1000) };
}

export function destroySession(id: string) {
  run('DELETE FROM sessions WHERE id = ?', [id]);
}

export function getSessionUser(token: string) {
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
