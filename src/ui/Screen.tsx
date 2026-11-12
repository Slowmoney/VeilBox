import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface ScreenProps {
  title: string;
  /** Secondary text next to the title. */
  subtitle?: string;
  /** Route to return to; shows the "‹" button when set. */
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Compact title row plus a scrolling body. */
export function Screen({ title, subtitle, back, actions, children }: ScreenProps) {
  const navigate = useNavigate();
  return (
    <section className="ui-screen">
      <header className="ui-screen__head">
        {back ? (
          <button type="button" className="ui-screen__back" aria-label="Back" onClick={() => navigate(back)}>
            <ChevronLeft size={22} />
          </button>
        ) : null}
        <div className="ui-screen__titles">
          <h1 className="ui-screen__title">{title}</h1>
          {subtitle ? <span className="ui-screen__sub">{subtitle}</span> : null}
        </div>
        {actions ? <div className="ui-screen__actions">{actions}</div> : null}
      </header>
      <div className="ui-screen__body">{children}</div>
    </section>
  );
}
