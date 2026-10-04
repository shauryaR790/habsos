import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { env, isProduction } from './env';

export type OtpVerifyResult = 'VERIFIED' | 'FAILED' | 'EXPIRED';

export interface OtpProvider {
  readonly name: string;
  sendOtp(input: { mobile: string; code: string }): Promise<{ providerRef: string }>;
  verifyOtp(input: { mobile: string; code: string; challengeId: string; providerRef: string; codeHash: string }): Promise<OtpVerifyResult>;
}

const devCodes = new Map<string, string>();

export function rememberDevCode(challengeId: string, code: string) {
  if (!isProduction()) devCodes.set(challengeId, code);
}

export function peekDevCode(challengeId: string) {
  return devCodes.get(challengeId);
}

function hashCode(challengeId: string, code: string) {
  return createHash('sha256').update(`${env.sessionSecret}:${challengeId}:${code}`).digest('hex');
}

export function makeOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(challengeId: string, code: string) {
  return hashCode(challengeId, code);
}

function hashesMatch(expected: string, actual: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

class MockOtpProvider implements OtpProvider {
  readonly name = 'mock';

  async sendOtp(input: { mobile: string; code: string }) {
    if (!isProduction() && env.otpDevExpose && env.nodeEnv === 'development') {
      console.info(`[otp:dev] ${input.mobile} ${input.code}`);
    }
    return { providerRef: `mock:${input.mobile}` };
  }

  async verifyOtp(input: { challengeId: string; code: string; codeHash: string }) {
    const actual = hashCode(input.challengeId, input.code);
    return hashesMatch(input.codeHash, actual) ? 'VERIFIED' : 'FAILED';
  }
}

class SmsOtpProvider implements OtpProvider {
  readonly name = 'sms';

  async sendOtp(input: { mobile: string; code: string }) {
    if (!env.smsAccountSid || !env.smsAuthToken || !env.smsFrom) {
      throw new Error('SMS provider is not configured');
    }
    const body = new URLSearchParams({
      To: `+91${input.mobile}`,
      From: env.smsFrom,
      Body: `Your After Dunes code is ${input.code}`,
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.smsAccountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.smsAccountSid}:${env.smsAuthToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!response.ok) {
      throw new Error('SMS provider rejected the message');
    }
    const json = (await response.json()) as { sid?: string };
    return { providerRef: json.sid || 'sms' };
  }

  async verifyOtp(input: { challengeId: string; code: string; codeHash: string }) {
    const actual = hashCode(input.challengeId, input.code);
    return hashesMatch(input.codeHash, actual) ? 'VERIFIED' : 'FAILED';
  }
}

export function createOtpProvider(): OtpProvider {
  if (env.otpProvider === 'sms') return new SmsOtpProvider();
  if (env.otpProvider !== 'mock' && isProduction()) {
    throw new Error(`Unknown OTP provider: ${env.otpProvider}`);
  }
  return new MockOtpProvider();
}

export const otpProvider = createOtpProvider();
