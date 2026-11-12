import { X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function Toasts() {
  const toasts = useAppStore((state) => state.toasts);
  const dismissToast = useAppStore((state) => state.dismissToast);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="ui-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`ui-toast ui-toast--${toast.tone}`}>
          <div className="ui-toast__text">
            <strong className="ui-toast__title">{toast.title}</strong>
            {toast.message ? <p className="ui-toast__msg">{toast.message}</p> : null}
          </div>
          <button type="button" className="ui-iconbtn" aria-label="OK" onClick={() => dismissToast(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
