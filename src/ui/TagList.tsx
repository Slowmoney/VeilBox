import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Field';

interface TagListProps {
  items: string[];
  placeholder?: string;
  addLabel: string;
  /** Returns an error text to reject the value, or null to accept it. */
  validate?: (value: string, items: string[]) => string | null;
  onChange: (items: string[]) => void;
}

/** Removable tags with a "+" that opens an inline input. */
export function TagList({ items, placeholder, addLabel, validate, onChange }: TagListProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAdding(false);
    setDraft('');
    setError(null);
  };

  const submit = () => {
    const values = draft
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (values.length === 0) {
      close();
      return;
    }
    let next = items;
    for (const value of values) {
      const problem = validate?.(value, next) ?? null;
      if (problem) {
        setError(problem);
        return;
      }
      if (!next.includes(value)) {
        next = [...next, value];
      }
    }
    onChange(next);
    close();
  };

  return (
    <>
      <div className="ui-tags">
        {items.map((item) => (
          <span key={item} className="ui-tag">
            <span>{item}</span>
            <button type="button" aria-label={`${item} ×`} onClick={() => onChange(items.filter((entry) => entry !== item))}>
              <X size={12} />
            </button>
          </span>
        ))}
        {!adding ? (
          <button type="button" className="ui-tag ui-tag--add" aria-label={addLabel} onClick={() => setAdding(true)}>
            <Plus size={14} />
          </button>
        ) : null}
      </div>
      {adding ? (
        <>
          <div className="ui-tagform">
            <Input
              autoFocus
              value={draft}
              placeholder={placeholder}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
                if (event.key === 'Escape') {
                  close();
                }
              }}
            />
            <Button size="sm" onClick={submit}>
              {addLabel}
            </Button>
          </div>
          {error ? <div className="ui-tagform-error">{error}</div> : null}
        </>
      ) : null}
    </>
  );
}
