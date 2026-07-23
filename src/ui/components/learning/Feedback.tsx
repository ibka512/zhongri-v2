import type { ReactNode } from 'react';

import { AlertIcon, CheckIcon, LightIcon } from '../icons';
import './learning.css';

export type FeedbackTone = 'success' | 'error' | 'hint';

export interface FeedbackProps {
  children: ReactNode;
  title: string;
  tone: FeedbackTone;
}

export function Feedback({ children, title, tone }: FeedbackProps) {
  return (
    <section
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="zr-feedback"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span aria-hidden="true" className="zr-feedback__icon">
        {tone === 'success' && <CheckIcon />}
        {tone === 'error' && <AlertIcon />}
        {tone === 'hint' && <LightIcon />}
      </span>
      <div>
        <h4>{title}</h4>
        <div className="zr-feedback__body">{children}</div>
      </div>
    </section>
  );
}
