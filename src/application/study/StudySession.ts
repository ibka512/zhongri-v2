import type { AnswerValue, JudgementResult, LearningEvent, Question } from '../../schemas/v1';

export interface StudyItem {
  itemId: string;
  question: Question;
}

export type StudySessionStatus = 'answering' | 'feedback' | 'completed';

export interface StudySessionSnapshot {
  currentIndex: number;
  currentItem: StudyItem | null;
  events: readonly LearningEvent[];
  judgement: JudgementResult | null;
  selectedAnswer: AnswerValue | null;
  sessionId: string;
  status: StudySessionStatus;
  total: number;
  userId: string;
}
