import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { AlertIcon, CheckIcon } from './icons';
import './Button.css';

export type ButtonState = 'default' | 'pressed' | 'loading' | 'success' | 'error' | 'disabled';
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ai';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  state?: ButtonState;
  variant?: ButtonVariant;
  loadingLabel?: string;
}

export function Button({
  children,
  className,
  disabled,
  loadingLabel = '处理中',
  state = 'default',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const resolvedState = disabled ? 'disabled' : state;
  const isUnavailable = resolvedState === 'disabled' || resolvedState === 'loading';
  const classes = ['zr-button', className].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      aria-busy={resolvedState === 'loading' || undefined}
      className={classes}
      data-state={resolvedState}
      data-variant={variant}
      disabled={isUnavailable}
      type={type}
    >
      {resolvedState === 'success' && <CheckIcon className="zr-button__icon" />}
      {resolvedState === 'error' && <AlertIcon className="zr-button__icon" />}
      <span>{resolvedState === 'loading' ? loadingLabel : children}</span>
    </button>
  );
}
