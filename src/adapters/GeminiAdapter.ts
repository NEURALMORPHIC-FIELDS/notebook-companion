// GeminiAdapter.ts — Google Gemini API adapter
import { BaseLLMAdapter, LLMMessage, LLMResponse, LLMConfig } from './BaseLLMAdapter';

export class GeminiAdapter extends BaseLLMAdapter {
    private static readonly DEFAULT_MODEL = 'gemini-2.0-flash';

    public get providerName(): string {
        return 'Google Gemini';
    }

    public async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
        const startTime = Date.now();
        const mergedConfig = { ...this.config, ...options };

        if (!mergedConfig.apiKey) {
            throw new Error('[Gemini] API key required.');
        }

        const model = mergedConfig.model || GeminiAdapter.DEFAULT_MODEL;
        const baseUrl = mergedConfig.baseUrl ||
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        // Convert to Gemini format
        const systemMsg = messages.find(m => m.role === 'system');
        const chatMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        const body: Record<string, unknown> = {
            contents: chatMessages,
            generationConfig: {
                maxOutputTokens: mergedConfig.maxTokens ?? 4096,
                temperature: mergedConfig.temperature ?? 0.7,
            },
        };
        if (systemMsg) {
            body.systemInstruction = { parts: [{ text: systemMsg.content }] };
        }

        const response = await fetch(`${baseUrl}?key=${mergedConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(mergedConfig.timeout ?? 60000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`[Gemini] HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const latencyMs = Date.now() - startTime;

        return {
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
            model,
            tokensUsed: {
                prompt: data.usageMetadata?.promptTokenCount || 0,
                completion: data.usageMetadata?.candidatesTokenCount || 0,
                total: data.usageMetadata?.totalTokenCount || 0,
            },
            latencyMs,
            raw: data,
        };
    }

    public async healthCheck(): Promise<boolean> {
        try {
            if (!this.config.apiKey) return false;
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
            return response.ok;
        } catch {
            return false;
        }
    }
}
