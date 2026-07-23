import { useId, useRef, type FormEvent } from 'react';

import { Button } from '../Button';
import './learning.css';

export type TextAnswerStatus = 'idle' | 'error' | 'disabled';

export interface TextAnswerProps {
  errorMessage?: string;
  label: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  status?: TextAnswerStatus;
  submitLabel?: string;
  value: string;
}

export function TextAnswer({
  errorMessage,
  label,
  onChange,
  onSubmit,
  placeholder,
  status = 'idle',
  submitLabel = '提交答案',
  value,
}: TextAnswerProps) {
  const inputId = useId();
  const errorId = useId();
  const isComposing = useRef(false);
  const isDisabled = status === 'disabled';
  const hasError = status === 'error' && Boolean(errorMessage);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isComposing.current && !isDisabled) {
      onSubmit();
    }
  };

  return (
    <form className="zr-text-answer" onSubmit={handleSubmit}>
      <label htmlFor={inputId}>{label}</label>
      <input
        aria-describedby={hasError ? errorId : undefined}
        aria-invalid={hasError}
        autoComplete="off"
        disabled={isDisabled}
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        onCompositionEnd={() => {
          isComposing.current = false;
        }}
        onCompositionStart={() => {
          isComposing.current = true;
        }}
        placeholder={placeholder}
        type="text"
        value={value}
      />
      <p
        aria-hidden={!hasError}
        className="zr-text-answer__error"
        id={errorId}
        role={hasError ? 'alert' : undefined}
      >
        {hasError ? errorMessage : '　'}
      </p>
      <Button disabled={isDisabled || value.trim().length === 0} type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
