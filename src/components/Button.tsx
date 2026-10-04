import type { ButtonHTMLAttributes } from 'react';

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'quiet';
  full?: boolean;
};

export function Button({ variant = 'primary', full, className, type = 'button', ...rest }: Props) {
  return <button type={type} className={cx('btn', `btn-${variant}`, full && 'btn-full', className)} {...rest} />;
}
