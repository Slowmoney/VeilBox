import type { ReactNode } from 'react';

interface ChipProps {
  tone?: 'default' | 'ok' | 'warn' | 'bad';
  onClick?: () => void;
  title?: string;
  children: ReactNode;
}

export function Chip({ tone = 'default', onClick, title, children }: ChipProps) {
  const className = `ui-chip${tone === 'default' ? '' : ` ui-chip--${tone}`}`;
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} title={title}>
        <span>{children}</span>
      </button>
    );
  }
  return (
    <span className={className} title={title}>
      <span>{children}</span>
    </span>
  );
}
