import { useId, type ReactNode } from 'react';

import { Card } from '../Card';
import { Progress } from '../Progress';
import './learning.css';

export interface QuestionFrameProps {
  answer: ReactNode;
  audio?: ReactNode;
  current: number;
  feedback?: ReactNode;
  prompt: ReactNode;
  total: number;
  typeLabel?: string;
}

export function QuestionFrame({
  answer,
  audio,
  current,
  feedback,
  prompt,
  total,
  typeLabel = '练习题',
}: QuestionFrameProps) {
  const titleId = useId();

  return (
    <Card className="zr-question-frame">
      <header className="zr-question-frame__header">
        <span className="zr-question-frame__type">{typeLabel}</span>
        <Progress
          detail={`${current} / ${total}`}
          kind="question"
          label="题目进度"
          max={total}
          value={current}
        />
      </header>
      <section aria-labelledby={titleId} className="zr-question-frame__prompt">
        <h3 className="zr-sr-only" id={titleId}>
          第 {current} 题
        </h3>
        {prompt}
      </section>
      {audio && <div className="zr-question-frame__audio">{audio}</div>}
      <div className="zr-question-frame__answer">{answer}</div>
      <div aria-live="polite" className="zr-question-frame__feedback">
        {feedback}
      </div>
    </Card>
  );
}
