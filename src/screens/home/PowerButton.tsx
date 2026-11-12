import { Power } from 'lucide-react';
import type { StageState } from './useStage';

interface PowerButtonProps {
  stage: StageState;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

export function PowerButton({ stage, label, disabled, onClick }: PowerButtonProps) {
  return (
    <button
      type="button"
      className={`power is-${stage}`}
      aria-label={label}
      aria-pressed={stage === 'connected'}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="power__ring" aria-hidden="true" />
      <Power size={48} strokeWidth={2} />
    </button>
  );
}
