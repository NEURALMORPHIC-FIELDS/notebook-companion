// BaseLLMAdapter.ts — abstract adapter for all LLM integrations

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    content: string;
    model: string;
    tokensUsed: { prompt: number; completion: number; total: number };
    latencyMs: number;
    raw?: any;
}

export interface LLMConfig {
    apiKey: string;
    baseUrl?: string;
    chatEndpoint?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

export abstract class BaseLLMAdapter {
    protected config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    /**
     * Send a chat completion request to the LLM.
     */
    public abstract chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse>;

    /**
     * Health check — verifies the adapter can reach the LLM endpoint.
     */
    public abstract healthCheck(): Promise<boolean>;

    /**
     * Returns the provider name for logging/observability.
     */
    public abstract get providerName(): string;
}
