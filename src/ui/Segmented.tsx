import type { CSSProperties } from 'react';

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function Segmented<T extends string>({ value, options, onChange, disabled }: SegmentedProps<T>) {
  return (
    <div className="ui-seg" role="radiogroup" style={{ '--seg-count': options.length } as CSSProperties}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={`ui-seg__item${option.value === value ? ' is-on' : ''}`}
          disabled={disabled}
          title={option.label}
          onClick={() => option.value !== value && onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
