import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="ui-field">
      <span className="ui-field__label">{label}</span>
      {children}
      {hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-input${className ? ` ${className}` : ''}`} {...rest} />;
}

export function TextArea({
  mono,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  return (
    <textarea
      className={`ui-textarea${mono ? ' ui-textarea--mono' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  );
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`ui-select${className ? ` ${className}` : ''}`} {...rest} />;
}
