import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface ListGroupProps {
  label?: string;
  /** Separate rounded rows instead of one joined group. */
  cards?: boolean;
  children: ReactNode;
}

export function ListGroup({ label, cards, children }: ListGroupProps) {
  return (
    <>
      {label ? <div className="ui-label">{label}</div> : null}
      <div className={`ui-group${cards ? ' ui-group--cards' : ''}`}>{children}</div>
    </>
  );
}

interface RowProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Free-form content instead of title/subtitle. */
  children?: ReactNode;
}

export function Row({
  title,
  subtitle,
  value,
  chevron,
  onClick,
  leading,
  trailing,
  selected,
  danger,
  disabled,
  children,
}: RowProps) {
  const className = `ui-row${selected ? ' is-selected' : ''}${danger ? ' is-danger' : ''}`;
  const content = (
    <>
      {leading ? <span className="ui-row__lead">{leading}</span> : null}
      <span className="ui-row__main">
        {children ?? (
          <>
            <span className="ui-row__title">{title}</span>
            {subtitle ? <span className="ui-row__sub">{subtitle}</span> : null}
          </>
        )}
      </span>
      {value != null ? <span className="ui-row__value">{value}</span> : null}
      {trailing ? <span className="ui-row__trail">{trailing}</span> : null}
      {chevron ? <ChevronRight size={16} className="ui-row__chev" /> : null}
    </>
  );

  // A row with its own trailing buttons must not be a button itself (no nesting).
  if (onClick && !trailing) {
    return (
      <button type="button" className={className} onClick={onClick} disabled={disabled} aria-current={selected || undefined}>
        {content}
      </button>
    );
  }
  if (onClick) {
    return (
      <div
        className={className}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onClick();
          }
        }}
        aria-current={selected || undefined}
      >
        {content}
      </div>
    );
  }
  return <div className={className}>{content}</div>;
}
