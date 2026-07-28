import { z } from 'zod';

import { AIGatewayResponseSchema, GenerateQuestionsRequestSchema } from './AITaskProtocolSchema';

export interface AITaskProtocolJsonSchemas {
  readonly request: Record<string, unknown>;
  readonly response: Record<string, unknown>;
}

/**
 * Export the same Zod source used at runtime for Gateway-side contract tests.
 * JSON Schema is generated on demand so it is not bundled into the PWA.
 */
export function createAITaskProtocolJsonSchemas(): AITaskProtocolJsonSchemas {
  return {
    request: z.toJSONSchema(GenerateQuestionsRequestSchema),
    response: z.toJSONSchema(AIGatewayResponseSchema),
  };
}
