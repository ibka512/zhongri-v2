import type { AnswerValue, JudgementResult, LearningEvent } from '../../schemas/v1';
import type { StudyItem, StudySessionSnapshot, StudySessionStatus } from './StudySession';

export interface RestoreQuestionFlowInput {
  currentIndex: number;
  events: readonly LearningEvent[];
  judgement: JudgementResult | null;
  selectedAnswer: AnswerValue | null;
  status: StudySessionStatus;
}

export class QuestionFlow {
  readonly #items: readonly StudyItem[];
  readonly #sessionId: string;
  readonly #userId: string;
  #currentIndex = 0;
  #events: LearningEvent[] = [];
  #judgement: JudgementResult | null = null;
  #selectedAnswer: AnswerValue | null = null;
  #status: StudySessionStatus = 'answering';

  constructor(
    items: readonly StudyItem[],
    sessionId: string,
    userId: string,
    restored?: RestoreQuestionFlowInput,
  ) {
    if (items.length === 0) {
      throw new Error('A study session requires at least one question');
    }

    this.#items = [...items];
    this.#sessionId = sessionId;
    this.#userId = userId;

    if (restored) {
      if (restored.currentIndex >= items.length) {
        throw new Error('Restored question index is outside the session');
      }

      this.#currentIndex = restored.currentIndex;
      this.#events = [...restored.events];
      this.#judgement = restored.judgement;
      this.#selectedAnswer = restored.selectedAnswer;
      this.#status = restored.status;
    }
  }

  getSnapshot(): StudySessionSnapshot {
    return {
      currentIndex: this.#currentIndex,
      currentItem: this.#status === 'completed' ? null : (this.#items[this.#currentIndex] ?? null),
      events: [...this.#events],
      judgement: this.#judgement,
      selectedAnswer: this.#selectedAnswer,
      sessionId: this.#sessionId,
      status: this.#status,
      total: this.#items.length,
      userId: this.#userId,
    };
  }

  recordAnswer(
    answer: AnswerValue,
    judgement: JudgementResult,
    events: readonly LearningEvent[],
  ): StudySessionSnapshot {
    if (this.#status !== 'answering') {
      throw new Error('The current question has already been answered');
    }

    this.#selectedAnswer = answer;
    this.#judgement = judgement;
    this.#events.push(...events);
    this.#status = 'feedback';

    return this.getSnapshot();
  }

  next(): StudySessionSnapshot {
    if (this.#status !== 'feedback') {
      throw new Error('Feedback must be shown before moving to the next question');
    }

    if (this.#currentIndex === this.#items.length - 1) {
      this.#status = 'completed';
      this.#judgement = null;
      this.#selectedAnswer = null;
      return this.getSnapshot();
    }

    this.#currentIndex += 1;
    this.#status = 'answering';
    this.#judgement = null;
    this.#selectedAnswer = null;

    return this.getSnapshot();
  }
}
