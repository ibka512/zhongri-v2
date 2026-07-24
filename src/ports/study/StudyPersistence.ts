import type { LearningEvent, StudySessionCheckpoint, StudySessionState } from '../../schemas/v1';

export interface ClockPort {
  now: () => Date;
}

export interface IdGeneratorPort {
  nextId: () => string;
}

export interface CommitAnswerInput {
  idempotencyKey: string;
  requestFingerprint: string;
  events: readonly LearningEvent[];
  checkpoint: StudySessionCheckpoint;
  sessionState: StudySessionState;
}

export interface CommitAnswerResult {
  status: 'committed' | 'replayed';
  events: readonly LearningEvent[];
  checkpoint: StudySessionCheckpoint;
  sessionState: StudySessionState;
}

export interface LearningTransactionPort {
  commitAnswer: (input: CommitAnswerInput) => Promise<CommitAnswerResult>;
}

export interface LearningEventRepositoryPort {
  findBySessionId: (sessionId: string) => Promise<readonly LearningEvent[]>;
}

export interface StudySessionRepositoryPort {
  clearSession: (sessionId: string) => Promise<void>;
  findCheckpoint: (sessionId: string) => Promise<StudySessionCheckpoint | null>;
  findSessionState: (sessionId: string) => Promise<StudySessionState | null>;
  saveSessionState: (state: StudySessionState) => Promise<StudySessionState>;
}

export interface StudyPersistencePort
  extends LearningTransactionPort, LearningEventRepositoryPort, StudySessionRepositoryPort {}

export class IdempotencyConflictError extends Error {
  constructor(idempotencyKey: string) {
    super(`Idempotency key "${idempotencyKey}" was reused for a different answer`);
    this.name = 'IdempotencyConflictError';
  }
}

export function createAnswerSubmissionFingerprint(input: {
  sessionId: string;
  questionId: string;
  answer: string | readonly string[];
}): string {
  return JSON.stringify([input.sessionId, input.questionId, input.answer]);
}
