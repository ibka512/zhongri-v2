import { describe, expect, it } from 'vitest';

import {
  AIGatewayResponseSchema,
  GenerateQuestionsRequestSchema,
  createAITaskProtocolJsonSchemas,
  parseGenerateQuestionsResponse,
} from '../../src/schemas/v1';
import {
  validGenerateQuestionsFailure,
  validGenerateQuestionsRequest,
  validGenerateQuestionsResponse,
} from '../fixtures/ai-task-protocol';

describe('AI Task Protocol v1 schemas', () => {
  it('accepts valid request, success, and stable failure fixtures', () => {
    expect(GenerateQuestionsRequestSchema.safeParse(validGenerateQuestionsRequest).success).toBe(
      true,
    );
    expect(AIGatewayResponseSchema.safeParse(validGenerateQuestionsResponse).success).toBe(true);
    expect(AIGatewayResponseSchema.safeParse(validGenerateQuestionsFailure).success).toBe(true);
  });

  it('rejects unknown fields and non-whitelisted tasks', () => {
    expect(
      GenerateQuestionsRequestSchema.safeParse({
        ...validGenerateQuestionsRequest,
        prompt: '自由 prompt',
      }).success,
    ).toBe(false);
    expect(
      GenerateQuestionsRequestSchema.safeParse({
        ...validGenerateQuestionsRequest,
        task: 'explainError',
      }).success,
    ).toBe(false);
  });

  it('rejects mismatched language, duplicate content ids, and over-sized targets', () => {
    expect(
      GenerateQuestionsRequestSchema.safeParse({
        ...validGenerateQuestionsRequest,
        targetCount: 3,
      }).success,
    ).toBe(false);
    expect(
      GenerateQuestionsRequestSchema.safeParse({
        ...validGenerateQuestionsRequest,
        profile: { ...validGenerateQuestionsRequest.profile, language: 'en' },
      }).success,
    ).toBe(false);
    expect(
      GenerateQuestionsRequestSchema.safeParse({
        ...validGenerateQuestionsRequest,
        content: {
          ...validGenerateQuestionsRequest.content,
          items: [
            validGenerateQuestionsRequest.content.items[0],
            { ...validGenerateQuestionsRequest.content.items[1], itemId: 'word-ja-001' },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it('correlates responses with the request and rejects unknown items', () => {
    expect(
      parseGenerateQuestionsResponse(validGenerateQuestionsResponse, validGenerateQuestionsRequest),
    ).toEqual(validGenerateQuestionsResponse);
    expect(() =>
      parseGenerateQuestionsResponse(
        {
          ...validGenerateQuestionsResponse,
          requestId: 'different-request',
        },
        validGenerateQuestionsRequest,
      ),
    ).toThrow();
    expect(() =>
      parseGenerateQuestionsResponse(
        {
          ...validGenerateQuestionsResponse,
          result: {
            questions: [
              ...validGenerateQuestionsResponse.result.questions,
              {
                itemId: 'unknown-item',
                question: validGenerateQuestionsResponse.result.questions[0].question,
              },
            ],
          },
        },
        validGenerateQuestionsRequest,
      ),
    ).toThrow();
  });

  it('exports JSON Schema from the same Zod source', () => {
    const schemas = createAITaskProtocolJsonSchemas();
    expect(schemas.request.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schemas.request.type).toBe('object');
    expect(schemas.request.additionalProperties).toBe(false);
    expect(Array.isArray(schemas.response.oneOf)).toBe(true);
    expect(
      (schemas.response.oneOf as Array<Record<string, unknown>>).every(
        (schema) => schema.type === 'object',
      ),
    ).toBe(true);
  });
});
