import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, razorpayEnabled } from './env';
type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string };

export class RazorpayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RazorpayError';
  }
}

export function publicRazorpayKey() {
  return razorpayEnabled() ? env.razorpayKeyId : '';
}

function authHeader() {
  return `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64')}`;
}

export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<RazorpayOrder> {
  if (!razorpayEnabled()) throw new RazorpayError('Online payments are not configured.');
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new RazorpayError('Amount must be at least ₹1.');
  }
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: receipt.slice(0, 40),
    }),
  });
  if (!response.ok) {
    throw new RazorpayError('Could not start the online payment.');
  }
  return (await response.json()) as RazorpayOrder;
}

export function verifyRazorpayPayment(razorpayOrderId: string, razorpayPaymentId: string, signature: string) {
  if (!razorpayEnabled()) throw new RazorpayError('Online payments are not configured.');
  const expected = createHmac('sha256', env.razorpayKeySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new RazorpayError('Payment verification failed.');
  }
}
