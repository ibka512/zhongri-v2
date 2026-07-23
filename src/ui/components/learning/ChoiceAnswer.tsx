import { AlertIcon, CheckIcon } from '../icons';
import './learning.css';

export interface ChoiceOption {
  id: string;
  label: string;
}

export type ChoiceAnswerStatus = 'idle' | 'correct' | 'incorrect' | 'disabled';

export interface ChoiceAnswerProps {
  correctOptionId?: string;
  disabled?: boolean;
  label: string;
  onChange: (optionId: string) => void;
  options: readonly ChoiceOption[];
  status?: ChoiceAnswerStatus;
  value: string | null;
}

export function ChoiceAnswer({
  correctOptionId,
  disabled = false,
  label,
  onChange,
  options,
  status = 'idle',
  value,
}: ChoiceAnswerProps) {
  const isLocked = disabled || status !== 'idle';

  return (
    <fieldset className="zr-choice-answer">
      <legend className="zr-sr-only">{label}</legend>
      {options.map((option) => {
        const isSelected = value === option.id;
        const isCorrect = status !== 'idle' && option.id === correctOptionId;
        const isIncorrect = status === 'incorrect' && isSelected && !isCorrect;
        const optionState = isCorrect
          ? 'correct'
          : isIncorrect
            ? 'incorrect'
            : isSelected
              ? 'selected'
              : isLocked
                ? 'disabled'
                : 'default';

        return (
          <button
            aria-pressed={isSelected}
            className="zr-choice-answer__option"
            data-state={optionState}
            disabled={isLocked}
            key={option.id}
            onClick={() => onChange(option.id)}
            type="button"
          >
            <span aria-hidden="true" className="zr-choice-answer__marker">
              {isCorrect && <CheckIcon />}
              {isIncorrect && <AlertIcon />}
            </span>
            <span>{option.label}</span>
            {isCorrect && <span className="zr-choice-answer__state-label">正确</span>}
            {isIncorrect && <span className="zr-choice-answer__state-label">再看一下</span>}
          </button>
        );
      })}
    </fieldset>
  );
}
