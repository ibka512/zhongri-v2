import {
  JudgementResultSchema,
  JudgementStatus,
  QuestionType,
  type AnswerValue,
  type JudgementResult,
  type Question,
} from '../../schemas/v1';

function asAnswerList(answer: AnswerValue): readonly string[] {
  return Array.isArray(answer) ? answer : [answer];
}

function hasSameAnswers(userAnswer: AnswerValue, expectedAnswer: AnswerValue): boolean {
  const submitted = new Set(asAnswerList(userAnswer));
  const expected = new Set(asAnswerList(expectedAnswer));

  return submitted.size === expected.size && [...submitted].every((answer) => expected.has(answer));
}

export function judgeAnswer(question: Question, userAnswer: AnswerValue): JudgementResult {
  if (question.type === QuestionType.TextInput) {
    if (typeof userAnswer !== 'string') {
      throw new Error('Text input questions require a text answer');
    }

    const normalize = (answer: string) => {
      const trimmed = question.answer.trimWhitespace ? answer.trim() : answer;
      return question.answer.caseSensitive ? trimmed : trimmed.toLocaleLowerCase();
    };
    const isCorrect = question.answer.acceptedAnswers.some(
      (answer) => normalize(answer) === normalize(userAnswer),
    );
    const expectedAnswer = question.answer.acceptedAnswers[0];

    return JudgementResultSchema.parse({
      schemaVersion: 1,
      questionId: question.id,
      status: isCorrect ? JudgementStatus.Correct : JudgementStatus.Incorrect,
      userAnswer,
      expectedAnswer,
      errorReason: isCorrect
        ? null
        : {
            code: 'text_mismatch',
            message: 'The submitted text does not match an accepted answer.',
          },
      feedbackText: isCorrect ? '回答正确。' : `正确答案是「${expectedAnswer}」。`,
      requiresAiExplanation: false,
    });
  }

  if (question.type !== QuestionType.Choice) {
    throw new Error(`Question type "${question.type}" is not supported by the deterministic judge`);
  }

  const expectedAnswer: AnswerValue =
    question.answer.correctOptionIds.length === 1
      ? question.answer.correctOptionIds[0]
      : question.answer.correctOptionIds;
  const isCorrect = hasSameAnswers(userAnswer, expectedAnswer);

  return JudgementResultSchema.parse({
    schemaVersion: 1,
    questionId: question.id,
    status: isCorrect ? JudgementStatus.Correct : JudgementStatus.Incorrect,
    userAnswer,
    expectedAnswer,
    errorReason: isCorrect
      ? null
      : {
          code: 'choice_mismatch',
          message: 'The selected option does not match the expected answer.',
        },
    feedbackText: isCorrect ? '回答正确。' : '再看一下正确选项，理解后继续。',
    requiresAiExplanation: false,
  });
}
