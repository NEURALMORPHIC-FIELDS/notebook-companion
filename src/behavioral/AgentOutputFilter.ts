/**
 * AgentOutputFilter.ts — anti-spam filter for all agent outputs
 * NEXUS AI v6 — Behavioral Rule #1 (§3.1 ARCHITECTURE.md)
 *
 * ARCHITECTURE.md Rule #1 — Zero Spam. Zero Repetition:
 *   "Before sending any output, every NEXUS AI agent runs AgentOutputFilter:
 *    Similarity > 0.85 with recent messages → BLOCKED (DUPLICATE)
 *    No new actionable information → BLOCKED (NO_NEW_INFO)
 *    No concrete trigger → BLOCKED (NO_TRIGGER)
 *    Agents are SILENT when they have nothing to say."
 *
 * ARCHITECTURE.md Real Failure:
 *   "Opus sent 'Awaiting instructions.' / 'Done.' more than 30 times
 *    consecutively — zero new information."
 *
 * Similarity algorithm: Jaccard similarity on character trigrams.
 * Trigrams are computed case-insensitively. No external dependencies.
 */

export interface FilterResult {
    send: boolean;
    reason?: 'DUPLICATE' | 'NO_NEW_INFO' | 'NO_TRIGGER' | 'PASSED';
}

export interface AgentContext {
    phaseChanged?: boolean;
    errorOccurred?: boolean;
    userWaiting?: boolean;
    milestoneReached?: boolean;
    [key: string]: unknown;
}

/** Phrases that are never new information, regardless of context */
const NOISE_PHRASES = new Set([
    'awaiting instructions.',
    'done.',
    'ready.',
    'i\'m here.',
    'how can i help?',
    'please let me know.',
    'understood.',
    'noted.',
]);

export class AgentOutputFilter {
    /** In-memory ring buffer of recent sent messages (max 50) */
    private recentMessages: string[] = [];
    private readonly MAX_BUFFER = 50;
    private readonly SIMILARITY_THRESHOLD = 0.85;

    /**
     * Gate that decides whether to send a message.
     * If any rule fails, the message is silenced (no output is better than noise).
     */
    public shouldSend(message: string, context: AgentContext): FilterResult {
        // Check 1: Too similar to a recently sent message?
        const similarity = this.computeSimilarity(message, this.recentMessages);
        if (similarity > this.SIMILARITY_THRESHOLD) {
            return { send: false, reason: 'DUPLICATE' };
        }

        // Check 2: Does the message add new or actionable information?
        if (!this.containsNewInformation(message)) {
            return { send: false, reason: 'NO_NEW_INFO' };
        }

        // Check 3: Is there a concrete trigger justifying the message?
        const hasTrigger = Boolean(
            context.phaseChanged ||
            context.errorOccurred ||
            context.userWaiting ||
            context.milestoneReached
        );
        if (!hasTrigger) {
            return { send: false, reason: 'NO_TRIGGER' };
        }

        // Store the message in the ring buffer
        this.recentMessages.push(message);
        if (this.recentMessages.length > this.MAX_BUFFER) {
            this.recentMessages.shift();
        }

        return { send: true, reason: 'PASSED' };
    }

    /**
     * Jaccard similarity on character trigrams.
     * Returns max similarity against any message in the recent buffer.
     *
     * Replaces: previous naïve exact-match + prefix substring approach.
     * Range: [0, 1]. Values above SIMILARITY_THRESHOLD → DUPLICATE.
     */
    private computeSimilarity(msg: string, recent: string[]): number {
        if (recent.length === 0) return 0;
        const msgTrigrams = this.getCharacterTrigrams(msg);
        if (msgTrigrams.size === 0) return 0;

        let maxSimilarity = 0;
        for (const r of recent) {
            const rTrigrams = this.getCharacterTrigrams(r);
            const intersectionSize = [...msgTrigrams].filter(g => rTrigrams.has(g)).length;
            const unionSize = new Set([...msgTrigrams, ...rTrigrams]).size;
            if (unionSize > 0) {
                const jaccard = intersectionSize / unionSize;
                if (jaccard > maxSimilarity) maxSimilarity = jaccard;
            }
        }
        return maxSimilarity;
    }

    /**
     * Generate character-level trigrams from a string.
     * e.g. "hello" → Set { "hel", "ell", "llo" }
     * Case-normalized, whitespace-collapsed.
     */
    private getCharacterTrigrams(text: string): Set<string> {
        const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
        const grams = new Set<string>();
        for (let i = 0; i <= normalized.length - 3; i++) {
            grams.add(normalized.substring(i, i + 3));
        }
        return grams;
    }

    /**
     * Check if a message adds new information beyond known noise phrases.
     * Expanded list of patterns that are never actionable.
     */
    private containsNewInformation(message: string): boolean {
        const normalized = message.trim().toLowerCase();
        // Exact noise phrase match
        if (NOISE_PHRASES.has(normalized)) return false;
        // Very short messages with no substance
        if (normalized.length < 10) return false;
        return true;
    }
}
