// AgentOutputFilter.ts — run on ANY output before sending
// NEXUS AI Rule #1 — Zero Spam. Zero Repetition.

export interface FilterResult {
    send: boolean;
    reason?: string;
}

export interface AgentContext {
    phaseChanged?: boolean;
    errorOccurred?: boolean;
    userWaiting?: boolean;
    milestoneReached?: boolean;
    [key: string]: any;
}

export class AgentOutputFilter {
    private recentMessages: string[] = [];

    public shouldSend(message: string, context: AgentContext): FilterResult {
        // 1. Have I already said this in the last N messages?
        const similarity = this.computeSimilarity(message, this.recentMessages);
        if (similarity > 0.85) return {
            send: false,
            reason: 'DUPLICATE — nearly identical message sent recently'
        };

        // 2. Does the message add new or actionable information?
        const hasNewInfo = this.containsNewInformation(message, context);
        if (!hasNewInfo) return {
            send: false,
            reason: 'NO_NEW_INFO — message adds no value'
        };

        // 3. Is there a concrete reason to send now?
        const hasReason = context.phaseChanged || context.errorOccurred
            || context.userWaiting || context.milestoneReached;

        if (!hasReason) return {
            send: false,
            reason: 'NO_TRIGGER — no event justifying the message'
        };

        this.recentMessages.push(message);
        if (this.recentMessages.length > 50) {
            this.recentMessages.shift();
        }

        return { send: true };
    }

    private computeSimilarity(msg: string, recent: string[]): number {
        if (recent.length === 0) return 0;
        // Basic similarity check for mockup purposes (can be enhanced with Levenshtein etc.)
        const exactMatch = recent.find(r => r === msg);
        if (exactMatch) return 1;
        // Further simplistic matching
        const thresholdMatch = recent.find(r => r.length > 0 && r.includes(msg.substring(0, Math.floor(msg.length / 2))));
        return thresholdMatch ? 0.9 : 0;
    }

    private containsNewInformation(msg: string, ctx: AgentContext): boolean {
        if (msg.trim() === 'Awaiting instructions.' || msg.trim() === 'Done.') return false;
        return true; // Simplified for demo
    }
}
