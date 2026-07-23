import { useState } from 'react';

import { StudyUseCase, type StudySessionSnapshot } from '../../application/study';
import { studyDemoItems } from '../../mock/questions';
import { JudgementStatus, QuestionType } from '../../schemas/v1';
import { Button, Card, Progress } from '../../ui/components';
import { ChoiceAnswer, Feedback, QuestionFrame } from '../../ui/components/learning';
import './study-demo.css';

function createDemoUseCase(): StudyUseCase {
  let eventSequence = 0;

  return new StudyUseCase(
    {
      items: studyDemoItems,
      sessionId: 'task004-demo-session',
      userId: 'task004-demo-user',
    },
    {
      createId: () => {
        eventSequence += 1;
        return `task004-demo-event-${eventSequence}`;
      },
      now: () => new Date(),
    },
  );
}

export function StudyDemoPage() {
  const [useCase] = useState(createDemoUseCase);
  const [snapshot, setSnapshot] = useState<StudySessionSnapshot>(() => useCase.getSnapshot());

  const currentQuestion = snapshot.currentItem?.question ?? null;

  if (snapshot.status === 'completed') {
    return (
      <main className="study-demo">
        <Card className="study-demo__completion">
          <p className="study-demo__eyebrow">技术验证完成</p>
          <h1>3 道示例题已完成</h1>
          <Progress
            detail={`${snapshot.total} / ${snapshot.total}`}
            kind="question"
            label="题目进度"
            max={snapshot.total}
            value={snapshot.total}
          />
          <p>本次内存会话生成了 {snapshot.events.length} 条 LearningEvent。刷新页面后会清空。</p>
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
        <p className="study-demo__eyebrow">Phase 1 · Task004</p>
        <h1>第一个学习闭环</h1>
        <p>使用 Mock Question 验证 Domain、Application、UI 与 Schema 的边界。</p>
      </header>

      <QuestionFrame
        answer={
          <ChoiceAnswer
            correctOptionId={currentQuestion.answer.correctOptionIds[0]}
            label={currentQuestion.prompt.instruction ?? '请选择答案'}
            onChange={(answer) => {
              setSnapshot(useCase.submitAnswer(answer));
            }}
            options={currentQuestion.options}
            status={isAnswered ? (isCorrect ? 'correct' : 'incorrect') : 'idle'}
            value={selectedAnswer}
          />
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
                onClick={() => {
                  setSnapshot(useCase.nextQuestion());
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
