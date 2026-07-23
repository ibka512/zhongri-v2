import { Button, type ButtonVariant } from '../Button';
import { CheckIcon } from '../icons';
import './AIBubble.css';

export type AIBubbleState = 'idle' | 'thinking' | 'suggestion' | 'success';

export interface AIBubbleAction {
  id: string;
  label: string;
  onSelect: () => void;
  variant?: Extract<ButtonVariant, 'ai' | 'tertiary'>;
}

export interface AIBubbleProps {
  actions?: readonly AIBubbleAction[];
  message: string;
  reason?: string;
  source?: string;
  state?: AIBubbleState;
}

export function AIBubble({
  actions = [],
  message,
  reason,
  source = 'AI 外教',
  state = 'idle',
}: AIBubbleProps) {
  return (
    <aside
      aria-busy={state === 'thinking' || undefined}
      aria-live="polite"
      className="zr-ai-bubble"
      data-state={state}
      role="status"
    >
      <header className="zr-ai-bubble__source">
        <span aria-hidden="true" className="zr-ai-bubble__mark">
          {state === 'success' && <CheckIcon />}
        </span>
        <span>{source}</span>
        {reason && <span className="zr-ai-bubble__reason">· {reason}</span>}
      </header>
      <p>{state === 'thinking' ? '正在整理提示，请稍候。' : message}</p>
      {actions.length > 0 && state !== 'thinking' && (
        <div className="zr-ai-bubble__actions">
          {actions.slice(0, 2).map((action) => (
            <Button key={action.id} onClick={action.onSelect} variant={action.variant ?? 'ai'}>
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </aside>
  );
}
