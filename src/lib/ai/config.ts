export const AI_MODELS = {
  fast: 'claude-sonnet-4-6',
  quality: 'claude-opus-4-6',
} as const;

export type AIModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];

export type AIEndpoint = 'flow-generation' | 'review' | 'spec-generation' | 'chat';

export interface EndpointConfig {
  model: AIModel;
  maxTokens: number;
  temperature: number;
}

export const ENDPOINT_CONFIG: Record<AIEndpoint, EndpointConfig> = {
  'flow-generation': {
    model: AI_MODELS.quality,
    maxTokens: 4096,
    temperature: 0.3,
  },
  review: {
    model: AI_MODELS.fast,
    maxTokens: 2048,
    temperature: 0.2,
  },
  'spec-generation': {
    model: AI_MODELS.quality,
    maxTokens: 8192,
    temperature: 0.2,
  },
  chat: {
    model: AI_MODELS.fast,
    maxTokens: 1024,
    temperature: 0.7,
  },
};

export const RATE_LIMITS: Record<AIEndpoint, number> = {
  'flow-generation': 10,
  review: 10,
  'spec-generation': 5,
  chat: 20,
};
