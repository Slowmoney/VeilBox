import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Bottom sheet: backdrop and Esc close it, Tab stays inside, focus returns on close. */
export function Sheet({ open, onClose, title, subtitle, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>('input, textarea, select') ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) {
        return;
      }
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <>
      <div className="ui-scrim" onClick={onClose} />
      <div ref={panelRef} className="ui-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="ui-sheet__grab" />
        {title ? (
          <div className="ui-sheet__head">
            <h2 className="ui-sheet__title">{title}</h2>
            {subtitle ? <p className="ui-sheet__sub">{subtitle}</p> : null}
          </div>
        ) : null}
        <div className="ui-sheet__body">{children}</div>
      </div>
    </>,
    document.body,
  );
}

interface SheetActionProps {
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** One line of an action sheet. */
export function SheetAction({ danger, disabled, onClick, children }: SheetActionProps) {
  return (
    <button type="button" className={`ui-act${danger ? ' is-danger' : ''}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
