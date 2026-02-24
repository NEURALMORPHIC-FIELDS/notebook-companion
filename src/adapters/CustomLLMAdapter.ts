// CustomLLMAdapter.ts — OpenAI-compatible HTTP adapter for custom endpoints
import { BaseLLMAdapter, LLMMessage, LLMResponse, LLMConfig } from './BaseLLMAdapter';

export class CustomLLMAdapter extends BaseLLMAdapter {
    public get providerName(): string {
        return 'Custom LLM';
    }

    public async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
        const startTime = Date.now();
        const mergedConfig = { ...this.config, ...options };

        const baseUrl = mergedConfig.baseUrl || mergedConfig.chatEndpoint;
        if (!baseUrl) {
            throw new Error('[CustomLLM] No baseUrl or chatEndpoint configured.');
        }

        const endpoint = mergedConfig.chatEndpoint || `${mergedConfig.baseUrl}/chat/completions`;
        const model = mergedConfig.model || 'default';

        const body = {
            model,
            messages,
            temperature: mergedConfig.temperature ?? 0.7,
            max_tokens: mergedConfig.maxTokens ?? 4096,
        };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (mergedConfig.apiKey) {
            headers['Authorization'] = `Bearer ${mergedConfig.apiKey}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(mergedConfig.timeout ?? 60000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`[CustomLLM] HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const latencyMs = Date.now() - startTime;

        return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || model,
            tokensUsed: {
                prompt: data.usage?.prompt_tokens || 0,
                completion: data.usage?.completion_tokens || 0,
                total: data.usage?.total_tokens || 0,
            },
            latencyMs,
            raw: data,
        };
    }

    public async healthCheck(): Promise<boolean> {
        try {
            const endpoint = this.config.baseUrl || this.config.chatEndpoint;
            if (!endpoint) return false;
            // Attempt a models list or a minimal request
            const response = await fetch(`${this.config.baseUrl}/models`, {
                method: 'GET',
                headers: this.config.apiKey
                    ? { 'Authorization': `Bearer ${this.config.apiKey}` }
                    : {},
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
