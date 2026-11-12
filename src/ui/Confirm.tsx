import { useTx } from '../lib/useTx';
import { Button } from './Button';
import { Sheet } from './Sheet';

interface ConfirmProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation of a destructive action as a small bottom sheet. */
export function Confirm({ open, title, message, confirmLabel, onConfirm, onClose }: ConfirmProps) {
  const tx = useTx();
  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={message}>
      <div className="ui-confirm">
        <Button variant="secondary" block onClick={onClose}>
          {tx('Отмена', 'Cancel')}
        </Button>
        <Button
          variant="danger"
          block
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
