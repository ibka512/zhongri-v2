import type {
  AIGatewayResponse,
  GenerateQuestionsRequest,
} from '../../schemas/v1/AITaskProtocolSchema';

/**
 * PWA-facing boundary. Implementations return a stable failure result for
 * expected network/provider failures instead of exposing transport errors to
 * the learning application.
 */
export interface AIGatewayPort {
  generateQuestions: (request: GenerateQuestionsRequest) => Promise<AIGatewayResponse>;
}
