import { api } from './api';

type CreateResponse = {
  orderId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  cafeName: string;
};

type RazorpayHandler = {
  open(): void;
};

type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayHandler;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = 'https://checkout.razorpay.com/v1/checkout.js';
      tag.async = true;
      tag.onload = () => resolve();
      tag.onerror = () => reject(new Error('Could not load Razorpay.'));
      document.head.appendChild(tag);
    });
  }
  return scriptPromise;
}

export async function collectRazorpayPayment(input: {
  orderId: string;
  amountInr?: number;
  public?: boolean;
  customerName?: string;
  customerMobile?: string;
}) {
  const createPath = input.public ? '/api/payments/razorpay/create-public' : '/api/payments/razorpay/create';
  const verifyPath = input.public ? '/api/payments/razorpay/verify-public' : '/api/payments/razorpay/verify';
  const session = await api<CreateResponse>(createPath, {
    method: 'POST',
    body: JSON.stringify({ orderId: input.orderId, amount: input.amountInr ? input.amountInr * 100 : undefined }),
  });
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay is unavailable.');
  return new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: session.razorpayKeyId,
      amount: session.amount,
      currency: session.currency,
      name: session.cafeName,
      description: `Order ${session.orderId.slice(0, 8)}`,
      order_id: session.razorpayOrderId,
      prefill: {
        name: input.customerName ?? '',
        contact: input.customerMobile ?? '',
      },
      theme: { color: '#c62828' },
      handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        void api(verifyPath, {
          method: 'POST',
          body: JSON.stringify({
            orderId: input.orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        }).then(() => resolve()).catch(reject);
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled.')),
      },
    });
    rzp.open();
  });
}
