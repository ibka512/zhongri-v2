import type { HTMLAttributes } from 'react';

import './Card.css';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  const classes = ['zr-card', className].filter(Boolean).join(' ');

  return <div {...props} className={classes} />;
}
