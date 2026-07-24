import { useEffect, useState } from 'react';

import type { StudySessionSnapshot, StudyUseCase } from '../../application/study';
import { JudgementStatus, QuestionType } from '../../schemas/v1';
import { Button, Card, Progress } from '../../ui/components';
import { ChoiceAnswer, Feedback, QuestionFrame } from '../../ui/components/learning';
import './study-demo.css';

export interface StudyDemoPageProps {
  createUseCase: () => Promise<StudyUseCase>;
}

export function StudyDemoPage({ createUseCase }: StudyDemoPageProps) {
  const [useCase, setUseCase] = useState<StudyUseCase | null>(null);
  const [snapshot, setSnapshot] = useState<StudySessionSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void createUseCase()
      .then((createdUseCase) => {
        if (!isActive) {
          return;
        }

        setUseCase(createdUseCase);
        setSnapshot(createdUseCase.getSnapshot());
      })
      .catch(() => {
        if (isActive) {
          setLoadError('学习会话恢复失败。现有进度未被覆盖。');
        }
      });

    return () => {
      isActive = false;
    };
  }, [createUseCase]);

  if (loadError) {
    return (
      <main className="study-demo">
        <Card>
          <h1>无法恢复学习会话</h1>
          <p role="alert">{loadError}</p>
        </Card>
      </main>
    );
  }

  if (!useCase || !snapshot) {
    return (
      <main className="study-demo">
        <p role="status">正在恢复本地学习会话…</p>
      </main>
    );
  }

  const currentQuestion = snapshot.currentItem?.question ?? null;

  if (snapshot.status === 'completed') {
    return (
      <main className="study-demo">
        <Card className="study-demo__completion">
          <p className="study-demo__eyebrow">本地会话已保存</p>
          <h1>3 道示例题已完成</h1>
          <Progress
            detail={`${snapshot.total} / ${snapshot.total}`}
            kind="question"
            label="题目进度"
            max={snapshot.total}
            value={snapshot.total}
          />
          <p>本次会话已有 {snapshot.events.length} 条 LearningEvent；刷新后仍会恢复完成状态。</p>
        </Card>
      </main>
    );
  }

  if (!currentQuestion || currentQuestion.type !== QuestionType.Choice) {
    throw new Error('Study demo only accepts choice questions');
  }

  const isAnswered = snapshot.status === 'feedback';
  const isCorrect = snapshot.judgement?.status === JudgementStatus.Correct;
  const selectedAnswer =
    typeof snapshot.selectedAnswer === 'string' ? snapshot.selectedAnswer : null;

  return (
    <main className="study-demo">
      <header className="study-demo__header">
        <p className="study-demo__eyebrow">Phase 1 · Task006</p>
        <h1>可恢复的学习会话</h1>
        <p>答题、反馈、下一题和完成状态均保存在本地。</p>
      </header>

      <QuestionFrame
        answer={
          <div>
            <ChoiceAnswer
              correctOptionId={currentQuestion.answer.correctOptionIds[0]}
              disabled={isSubmitting}
              label={currentQuestion.prompt.instruction ?? '请选择答案'}
              onChange={(answer) => {
                setIsSubmitting(true);
                setSubmissionError(null);
                void useCase
                  .submitAnswer(answer, `${snapshot.sessionId}:${currentQuestion.id}`)
                  .then(setSnapshot)
                  .catch(() => {
                    setSubmissionError('答案保存失败，请重试。');
                  })
                  .finally(() => {
                    setIsSubmitting(false);
                  });
              }}
              options={currentQuestion.options}
              status={isAnswered ? (isCorrect ? 'correct' : 'incorrect') : 'idle'}
              value={selectedAnswer}
            />
            {submissionError && <p role="alert">{submissionError}</p>}
          </div>
        }
        current={snapshot.currentIndex + 1}
        feedback={
          snapshot.judgement ? (
            <div className="study-demo__feedback">
              <Feedback
                title={isCorrect ? '理解正确' : '一起看清这个词'}
                tone={isCorrect ? 'success' : 'error'}
              >
                <p>{snapshot.judgement.feedbackText}</p>
                {currentQuestion.explanation && <p>{currentQuestion.explanation}</p>}
              </Feedback>
              <Button
                disabled={isSubmitting}
                onClick={() => {
                  setIsSubmitting(true);
                  setSubmissionError(null);
                  void useCase
                    .nextQuestion()
                    .then(setSnapshot)
                    .catch(() => {
                      setSubmissionError('进度保存失败，请重试。');
                    })
                    .finally(() => {
                      setIsSubmitting(false);
                    });
                }}
              >
                {snapshot.currentIndex === snapshot.total - 1 ? '完成练习' : '下一题'}
              </Button>
            </div>
          ) : null
        }
        prompt={
          <div className="study-demo__prompt">
            {currentQuestion.prompt.instruction && <p>{currentQuestion.prompt.instruction}</p>}
            <p className="zr-type-word" lang="ja">
              {currentQuestion.prompt.content}
            </p>
          </div>
        }
        total={snapshot.total}
        typeLabel="日语词汇 · Mock"
      />
    </main>
  );
}
