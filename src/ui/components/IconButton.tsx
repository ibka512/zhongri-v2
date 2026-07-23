import type { ButtonHTMLAttributes, ReactNode } from 'react';

import './IconButton.css';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  icon: ReactNode;
  label: string;
  pressed?: boolean;
}

export function IconButton({
  className,
  disabled,
  icon,
  label,
  pressed = false,
  type = 'button',
  ...props
}: IconButtonProps) {
  const classes = ['zr-icon-button', className].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      aria-label={label}
      aria-pressed={pressed || undefined}
      className={classes}
      data-state={disabled ? 'disabled' : pressed ? 'pressed' : 'default'}
      disabled={disabled}
      title={label}
      type={type}
    >
      {icon}
    </button>
  );
}
