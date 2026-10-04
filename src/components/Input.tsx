import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, id, ...rest }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <label className="field" htmlFor={fieldId}>
      <span>{label}</span>
      <input id={fieldId} aria-invalid={error ? true : undefined} {...rest} />
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function TextArea({ label, id, ...rest }: AreaProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <label className="field" htmlFor={fieldId}>
      <span>{label}</span>
      <textarea id={fieldId} {...rest} />
    </label>
  );
}
