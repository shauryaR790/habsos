import { useEffect, useRef } from 'react';

export function OtpBoxes({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="otp-boxes" onClick={() => ref.current?.focus()}>
      <label className="sr-only" htmlFor="otp-code">6-digit code</label>
      <input
        id="otp-code"
        ref={ref}
        className="otp-hidden"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className={`otp-cell${value[index] ? ' is-filled' : ''}${value.length === index ? ' is-active' : ''}`}
          aria-hidden="true"
        >
          {value[index] ?? ''}
        </span>
      ))}
    </div>
  );
}
