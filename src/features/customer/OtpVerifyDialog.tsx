import type { FormEvent } from 'react';
import { formatINR } from '../../../shared/domain';
import { OtpBoxes } from './OtpBoxes';

export function OtpVerifyDialog({
  mobileLabel,
  code,
  onCodeChange,
  error,
  busy,
  wait,
  devCode,
  onResend,
  onSubmit,
  total,
}: {
  mobileLabel: string;
  code: string;
  onCodeChange: (next: string) => void;
  error: string | null;
  busy: boolean;
  wait: number;
  devCode?: string;
  onResend: () => void;
  onSubmit: (event?: FormEvent) => void;
  total: number | null;
}) {
  return (
    <div className="ad-otp-dialog-root" role="presentation">
      <div className="ad-otp-dialog-backdrop" aria-hidden="true" />
      <div className="ad-otp-dialog ad-guest-desert-bg" role="dialog" aria-modal="true" aria-labelledby="ad-otp-dialog-title">
        <form id="otp-form" className="ad-otp-dialog-form" onSubmit={(event) => void onSubmit(event)}>
          <h2 id="ad-otp-dialog-title" className="ad-otp-dialog-title">
            Verify your mobile
          </h2>
          <p className="ad-otp-dialog-kicker">
            Six digits sent to <span className="otp-phone">{mobileLabel}</span>
          </p>
          <OtpBoxes value={code} onChange={onCodeChange} />
          {devCode ? (
            <button type="button" className="otp-dev" onClick={() => onCodeChange(devCode)}>
              Tap to fill {devCode}
            </button>
          ) : null}
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="button" className="otp-resend" disabled={wait > 0 || busy} onClick={() => void onResend()}>
            {wait > 0 ? `New code in ${wait}s` : 'Send another code'}
          </button>
          <button type="submit" className="pay-bar ad-otp-dialog-submit" disabled={busy || code.length !== 6} aria-busy={busy}>
            <span>{busy ? 'Placing order…' : 'Place order'}</span>
            {total != null ? <span>{formatINR(total)}</span> : null}
          </button>
        </form>
      </div>
    </div>
  );
}
