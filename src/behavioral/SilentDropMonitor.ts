// SilentDropMonitor — automatically injected into any component with reject logic
// NEXUS AI Rule #3 — Zero Silent Failures

export class SilentDropMonitor {
    private component: string;
    private threshold: number;
    private total: number = 0;
    private dropped: number = 0;
    private dropReasons: Record<string, number> = {};

    constructor(componentName: string, thresholdPct: number = 10.0) {
        this.component = componentName;
        this.threshold = thresholdPct;
    }

    public recordDrop(reason: string): void {
        this.total += 1;
        this.dropped += 1;
        this.dropReasons[reason] = (this.dropReasons[reason] || 0) + 1;

        const dropPct = 100 * this.dropped / this.total;
        if (dropPct > this.threshold) {
            console.warn(`[WARN] ${this.component}: ${dropPct.toFixed(1)}% drop rate (${this.dropped}/${this.total})`);
            console.warn(`[WARN] Top reasons: ${JSON.stringify(this.dropReasons)}`);
        }
    }

    public recordProcessed(): void {
        this.total += 1;
    }

    public summary(): object {
        const dropPctRounded = this.total > 0 ? Number((100 * this.dropped / this.total).toFixed(2)) : 0;
        return {
            component: this.component,
            total: this.total,
            dropped: this.dropped,
            drop_pct: dropPctRounded,
            reasons: this.dropReasons
        };
    }
}
