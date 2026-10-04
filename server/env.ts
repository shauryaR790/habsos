import { existsSync, readFileSync } from 'node:fs';

if (process.env.VERCEL) {
  process.env.NODE_ENV = 'production';
  process.env.DB_PATH = '/tmp/habsos.db';
}

if (process.argv.includes('--prod')) {
  process.env.NODE_ENV = 'production';
}

function applyFile(file: string) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

applyFile('.env');
if (!existsSync('.env')) applyFile('.env.example');

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8787),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-change-me',
  otpProvider: process.env.OTP_PROVIDER || 'mock',
  otpDevExpose: process.env.OTP_DEV_EXPOSE === 'true',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@habs.cafe',
  adminPassword: process.env.ADMIN_PASSWORD || 'habsos-admin',
  dbPath: process.env.DB_PATH || './data/habsos.db',
  smsAccountSid: process.env.SMS_ACCOUNT_SID || '',
  smsAuthToken: process.env.SMS_AUTH_TOKEN || '',
  smsFrom: process.env.SMS_FROM || '',
};

export function isProduction() {
  return env.nodeEnv === 'production';
}

export function exposeDevOtp() {
  return !isProduction() && env.nodeEnv === 'development' && env.otpDevExpose;
}
