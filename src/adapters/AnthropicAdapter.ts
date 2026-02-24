// AnthropicAdapter.ts — Claude API adapter
import { BaseLLMAdapter, LLMMessage, LLMResponse, LLMConfig } from './BaseLLMAdapter';

export class AnthropicAdapter extends BaseLLMAdapter {
    private static readonly DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
    private static readonly DEFAULT_MODEL = 'claude-sonnet-4-20250514';

    public get providerName(): string {
        return 'Anthropic Claude';
    }

    public async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
        const startTime = Date.now();
        const mergedConfig = { ...this.config, ...options };

        if (!mergedConfig.apiKey) {
            throw new Error('[Anthropic] API key required.');
        }

        const baseUrl = mergedConfig.baseUrl || AnthropicAdapter.DEFAULT_BASE_URL;
        const model = mergedConfig.model || AnthropicAdapter.DEFAULT_MODEL;

        // Convert to Anthropic format: separate system from user/assistant messages
        const systemMsg = messages.find(m => m.role === 'system');
        const chatMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content }));

        const body: Record<string, any> = {
            model,
            messages: chatMessages,
            max_tokens: mergedConfig.maxTokens ?? 4096,
        };
        if (systemMsg) {
            body.system = systemMsg.content;
        }

        const response = await fetch(`${baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': mergedConfig.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(mergedConfig.timeout ?? 60000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`[Anthropic] HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const latencyMs = Date.now() - startTime;

        return {
            content: data.content?.[0]?.text || '',
            model: data.model || model,
            tokensUsed: {
                prompt: data.usage?.input_tokens || 0,
                completion: data.usage?.output_tokens || 0,
                total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
            },
            latencyMs,
            raw: data,
        };
    }

    public async healthCheck(): Promise<boolean> {
        // Anthropic doesn't have a /models endpoint; we just verify the key format
        return !!this.config.apiKey && this.config.apiKey.startsWith('sk-ant-');
    }
}
