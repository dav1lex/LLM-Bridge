export interface LLMResponse {
  content: string;
  model: string;
  provider: 'openrouter' | 'gemini';
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterRequest {
  prompt: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  system_prompt?: string;
}

export interface GeminiRequest {
  prompt: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  system_prompt?: string;
}

export interface ConversationRequest {
  messages: ConversationMessage[];
  provider?: 'openrouter' | 'gemini';
  model?: string;
  max_tokens?: number;
  temperature?: number;
}