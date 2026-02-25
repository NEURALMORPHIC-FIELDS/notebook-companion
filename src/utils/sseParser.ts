/**
 * sseParser.ts — Shared Server-Sent Events stream parser
 * NEXUS AI v6 — Single source of truth for SSE parsing
 *
 * Replaces 4 duplicated SSE parsing blocks previously in:
 * - AgentLLMService.ts (x2)
 * - ChatPanel.tsx
 * - NotebookPanel.tsx
 *
 * Usage:
 *   for await (const chunk of parseSseStream(response.body)) {
 *     fullText += chunk;
 *   }
 */

/**
 * Async generator that parses a ReadableStream of SSE data,
 * yielding each text delta from `choices[0].delta.content`.
 * Terminates cleanly on [DONE] or stream end.
 */
export async function* parseSseStream(
    body: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, unknown> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });

            let idx: number;
            while ((idx = buf.indexOf('\n')) !== -1) {
                let line = buf.slice(0, idx);
                buf = buf.slice(idx + 1);

                // Normalize Windows line endings
                if (line.endsWith('\r')) line = line.slice(0, -1);

                // Skip comments and blank lines
                if (line.startsWith(':') || line.trim() === '') continue;

                // Only process data lines
                if (!line.startsWith('data: ')) continue;

                const json = line.slice(6).trim();

                // Stream terminator
                if (json === '[DONE]') return;

                try {
                    const parsed = JSON.parse(json);
                    const content: string | undefined = parsed.choices?.[0]?.delta?.content;
                    if (content) yield content;
                } catch {
                    // Partial JSON — put line back and wait for more data
                    buf = line + '\n' + buf;
                    break;
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Collects the full SSE stream into a single string.
 * Convenience wrapper around parseSseStream for non-streaming callers.
 */
export async function collectSseStream(body: ReadableStream<Uint8Array>): Promise<string> {
    let result = '';
    for await (const chunk of parseSseStream(body)) {
        result += chunk;
    }
    return result;
}
