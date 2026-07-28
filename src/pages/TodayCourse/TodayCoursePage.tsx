import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { TodayCourseSession } from '../../app/todayCourse';
import type { StudySessionSnapshot } from '../../application/study';
import { EventType, JudgementStatus, QuestionType, type TodayPlan } from '../../schemas/v1';
import { Button, Card, Progress } from '../../ui/components';
import { ChoiceAnswer, Feedback, QuestionFrame, TextAnswer } from '../../ui/components/learning';
import './today-course.css';

export interface TodayCoursePageProps {
  createCourse: () => Promise<TodayCourseSession>;
  restartCourse: (plan: TodayPlan) => Promise<TodayCourseSession>;
}

type CourseView = 'plan' | 'lesson';

function languageLabel(language: TodayPlan['language']): string {
  return language === 'ja' ? '日语' : '英语';
}

function pronunciationLabel(word: TodayCourseSession['words'][number]): string {
  return word.reading ?? word.phonetic ?? '暂无音标';
}

function hasStarted(snapshot: StudySessionSnapshot): boolean {
  return snapshot.status !== 'answering' || snapshot.currentIndex > 0 || snapshot.events.length > 0;
}

function RestartControl({
  blocked,
  onRestart,
}: {
  blocked: boolean;
  onRestart: () => Promise<void>;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConfirming) {
    return (
      <Button
        disabled={blocked}
        onClick={() => {
          setError(null);
          setIsConfirming(true);
        }}
        variant="tertiary"
      >
        重新开始今日课程
      </Button>
    );
  }

  return (
    <section aria-label="确认重新开始" className="today-course__restart" role="group">
      <p>这会删除今日课程的答题记录和进度，且无法撤销。</p>
      <div className="today-course__restart-actions">
        <Button
          disabled={isRestarting}
          onClick={() => {
            setError(null);
            setIsConfirming(false);
          }}
          variant="tertiary"
        >
          保留当前进度
        </Button>
        <Button
          className="today-course__restart-danger"
          loadingLabel="正在重新开始"
          onClick={() => {
            setError(null);
            setIsRestarting(true);
            void onRestart()
              .then(() => {
                setIsConfirming(false);
              })
              .catch(() => {
                setError('无法重新开始，原有进度仍然保留。请重试。');
              })
              .finally(() => {
                setIsRestarting(false);
              });
          }}
          state={isRestarting ? 'loading' : 'default'}
          variant="secondary"
        >
          确认重新开始
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function TodayCoursePage({ createCourse, restartCourse }: TodayCoursePageProps) {
  const [course, setCourse] = useState<TodayCourseSession | null>(null);
  const [snapshot, setSnapshot] = useState<StudySessionSnapshot | null>(null);
  const [view, setView] = useState<CourseView>('plan');
  const [textAnswer, setTextAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void createCourse()
      .then((createdCourse) => {
        if (!active) {
          return;
        }

        const restoredSnapshot = createdCourse.useCase.getSnapshot();
        setCourse(createdCourse);
        setSnapshot(restoredSnapshot);
        setView(restoredSnapshot.status === 'completed' ? 'lesson' : 'plan');
      })
      .catch(() => {
        if (active) {
          setLoadError('今日课程加载失败。现有本地进度没有被覆盖。');
        }
      });

    return () => {
      active = false;
    };
  }, [createCourse]);

  if (loadError) {
    return (
      <main className="today-course">
        <Card className="today-course__message">
          <p className="today-course__eyebrow">钟日 v2</p>
          <h1>暂时无法打开今日课程</h1>
          <p role="alert">{loadError}</p>
          <Button onClick={() => window.location.reload()} variant="secondary">
            重新加载
          </Button>
        </Card>
      </main>
    );
  }

  if (!course || !snapshot) {
    return (
      <main className="today-course today-course--loading">
        <p aria-live="polite" role="status">
          正在准备今日课程…
        </p>
      </main>
    );
  }

  const handleRestart = async () => {
    const restartedCourse = await restartCourse(course.plan);
    setCourse(restartedCourse);
    setSnapshot(restartedCourse.useCase.getSnapshot());
    setTextAnswer('');
    setSubmissionError(null);
    setView('plan');
  };

  const courseLanguageLabel = languageLabel(course.plan.language);

  if (view === 'plan') {
    const isContinuing = hasStarted(snapshot);
    const completedQuestions = snapshot.currentIndex + (snapshot.status === 'feedback' ? 1 : 0);

    return (
      <main className="today-course">
        <section aria-labelledby="today-plan-title" className="today-course__plan">
          <p className="today-course__eyebrow">钟日 · {course.plan.localDate}</p>
          <h1 id="today-plan-title">
            今天，稳稳学 {course.plan.items.length} 个{courseLanguageLabel}词
          </h1>
          <p className="today-course__lead">
            一次短练习，完成认义与主动回忆。课程内容已保存在应用中，离线也能继续。
          </p>
          <Card className="today-course__plan-card">
            <div className="today-course__plan-heading">
              <div>
                <p className="today-course__label">今日计划</p>
                <h2>{course.plan.title}</h2>
              </div>
              <span className="today-course__time">约 {course.plan.estimatedMinutes} 分钟</span>
            </div>
            <Progress
              detail={`${completedQuestions} / ${course.plan.items.length}`}
              kind="today"
              label="今日课程进度"
              max={course.plan.items.length}
              value={completedQuestions}
            />
            <section aria-labelledby="today-learning-evidence" className="today-course__evidence">
              <h3 id="today-learning-evidence">学习依据</h3>
              <dl>
                <div>
                  <dt>今天到期</dt>
                  <dd>{course.insights.dueReviewCount} 个词</dd>
                </div>
                <div>
                  <dt>近期薄弱</dt>
                  <dd>
                    {course.insights.recentIncorrectWords.length > 0
                      ? course.insights.recentIncorrectWords.map((word) => word.headword).join('、')
                      : '暂无薄弱证据'}
                  </dd>
                </div>
                <div>
                  <dt>历史正确率</dt>
                  <dd>
                    {course.insights.profile.answeredCount > 0
                      ? `${Math.round(course.insights.profile.accuracy * 100)}%`
                      : '完成后生成'}
                  </dd>
                </div>
              </dl>
              <p>
                {course.insights.profile.answeredCount > 0
                  ? '计划依据今天开始前的真实答题记录生成，当天保持稳定。'
                  : course.plan.language === 'ja'
                    ? '还没有历史答题证据，今天先从 N5 基础词开始。'
                    : '还没有历史答题证据，今天先从英语基础词开始。'}
              </p>
            </section>
            <ul className="today-course__facts">
              <li>
                {course.plan.items.length} 个真实{courseLanguageLabel}基础词
              </li>
              <li>3 道选择 · 2 道输入</li>
              <li>答题后立即查看读音与释义</li>
            </ul>
            <Button className="today-course__primary-action" onClick={() => setView('lesson')}>
              {isContinuing ? '继续今日课程' : '开始今日课程'}
            </Button>
          </Card>
          <div className="today-course__secondary-links">
            <Link className="today-course__secondary-link" to="/kana">
              练习五十音
            </Link>
            <Link className="today-course__secondary-link" to="/content">
              浏览内容
            </Link>
            <Link className="today-course__secondary-link" to="/onboarding">
              调整学习目标
            </Link>
            <Link className="today-course__secondary-link" to="/settings">
              设置与数据
            </Link>
            <Link className="today-course__secondary-link" to="/migration-preview">
              检查旧版备份
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const correctCount = snapshot.events.filter(
    (event) => event.eventType === EventType.AnswerCorrect,
  ).length;

  if (snapshot.status === 'completed') {
    return (
      <main className="today-course">
        <Card className="today-course__result">
          <p className="today-course__eyebrow">今日课程已保存在本地</p>
          <h1>
            今天的 {course.plan.items.length} 个{courseLanguageLabel}词，完成了
          </h1>
          <p className="today-course__score">
            <strong>{correctCount}</strong>
            <span> / {snapshot.total} 答对</span>
          </p>
          <Progress
            detail={`${snapshot.total} / ${snapshot.total}`}
            kind="today"
            label="今日课程进度"
            max={snapshot.total}
            value={snapshot.total}
          />
          <section aria-labelledby="learned-words-title" className="today-course__learned">
            <h2 id="learned-words-title">今天练过</h2>
            <ul>
              {course.words.map((word) => (
                <li key={word.id}>
                  <span lang={course.plan.language}>{word.headword}</span>
                  <small lang={course.plan.language}>{pronunciationLabel(word)}</small>
                  <span>{word.meaning}</span>
                </li>
              ))}
            </ul>
          </section>
          <Feedback title="接下来" tone="hint">
            <p>本次记录会在下次打开时重建学习画像，并进入之后的个性化复习计划。</p>
          </Feedback>
          <RestartControl blocked={false} onRestart={handleRestart} />
        </Card>
      </main>
    );
  }

  const currentQuestion = snapshot.currentItem?.question;
  if (!currentQuestion) {
    throw new Error('Active daily course requires a current question');
  }

  const isAnswered = snapshot.status === 'feedback';
  const isCorrect = snapshot.judgement?.status === JudgementStatus.Correct;
  const selectedAnswer =
    typeof snapshot.selectedAnswer === 'string' ? snapshot.selectedAnswer : null;
  const isBlocked = isSubmitting || isAnswered;

  const submitAnswer = (answer: string) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    void course.useCase
      .submitAnswer(answer, `${snapshot.sessionId}:${currentQuestion.id}`)
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        if (currentQuestion.type === QuestionType.TextInput) {
          setTextAnswer(answer);
        }
      })
      .catch(() => {
        setSubmissionError('答案保存失败，原有进度仍然保留。请重试。');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const answer =
    currentQuestion.type === QuestionType.Choice ? (
      <ChoiceAnswer
        correctOptionId={currentQuestion.answer.correctOptionIds[0]}
        disabled={isBlocked}
        label={currentQuestion.prompt.instruction ?? '请选择答案'}
        onChange={submitAnswer}
        options={currentQuestion.options}
        status={isAnswered ? (isCorrect ? 'correct' : 'incorrect') : 'idle'}
        value={selectedAnswer}
      />
    ) : (
      <TextAnswer
        label="你的答案"
        onChange={setTextAnswer}
        onSubmit={() => submitAnswer(textAnswer)}
        placeholder={`输入${courseLanguageLabel}词或读音`}
        status={isBlocked ? 'disabled' : 'idle'}
        submitLabel={isSubmitting ? '正在保存' : '提交答案'}
        value={isAnswered ? (selectedAnswer ?? textAnswer) : textAnswer}
      />
    );

  return (
    <main className="today-course today-course--lesson">
      <header className="today-course__lesson-header">
        <div>
          <p className="today-course__eyebrow">今日{courseLanguageLabel}</p>
          <h1>专注这一题</h1>
        </div>
        <RestartControl blocked={isSubmitting} onRestart={handleRestart} />
      </header>
      <QuestionFrame
        answer={
          <div className="today-course__answer">
            {answer}
            {submissionError && <p role="alert">{submissionError}</p>}
          </div>
        }
        current={snapshot.currentIndex + 1}
        feedback={
          snapshot.judgement ? (
            <div className="today-course__feedback">
              <Feedback
                title={isCorrect ? '理解正确' : '一起看清这个词'}
                tone={isCorrect ? 'success' : 'error'}
              >
                <p>{snapshot.judgement.feedbackText}</p>
                {currentQuestion.explanation && <p>{currentQuestion.explanation}</p>}
              </Feedback>
              <Button
                disabled={isSubmitting}
                loadingLabel="正在保存进度"
                onClick={() => {
                  setIsSubmitting(true);
                  setSubmissionError(null);
                  void course.useCase
                    .nextQuestion()
                    .then((nextSnapshot) => {
                      setSnapshot(nextSnapshot);
                      setTextAnswer('');
                    })
                    .catch(() => {
                      setSubmissionError('进度保存失败，当前反馈仍然保留。请重试。');
                    })
                    .finally(() => {
                      setIsSubmitting(false);
                    });
                }}
                state={isSubmitting ? 'loading' : 'default'}
              >
                {snapshot.currentIndex === snapshot.total - 1 ? '查看学习结果' : '下一题'}
              </Button>
            </div>
          ) : null
        }
        prompt={
          <div className="today-course__prompt">
            {currentQuestion.prompt.instruction && <p>{currentQuestion.prompt.instruction}</p>}
            <p
              className={
                currentQuestion.type === QuestionType.Choice
                  ? 'today-course__japanese-word'
                  : 'today-course__meaning'
              }
              lang={currentQuestion.type === QuestionType.Choice ? course.plan.language : undefined}
            >
              {currentQuestion.prompt.content}
            </p>
          </div>
        }
        total={snapshot.total}
        typeLabel={
          currentQuestion.type === QuestionType.Choice
            ? '词义选择'
            : `${courseLanguageLabel}主动回忆`
        }
      />
    </main>
  );
}
