// PhaseTracer.ts — phase timing and agent metrics for observability

import { StructuredLogger } from './StructuredLogger';

export interface PhaseMetrics {
    phase: string;
    agent: string;
    startTime: number;
    endTime?: number;
    durationMs?: number;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
    veritasExitCode?: number;
    daBlocked?: boolean;
    hitlStatus?: string;
}

export class PhaseTracer {
    private static instance: PhaseTracer;
    private activeTraces: Map<string, PhaseMetrics> = new Map();
    private completedTraces: PhaseMetrics[] = [];
    private logger = StructuredLogger.getInstance();

    public static getInstance(): PhaseTracer {
        if (!PhaseTracer.instance) {
            PhaseTracer.instance = new PhaseTracer();
        }
        return PhaseTracer.instance;
    }

    public startPhase(phase: string, agent: string): string {
        const traceId = `trace-${phase}-${Date.now()}`;
        const metrics: PhaseMetrics = {
            phase,
            agent,
            startTime: Date.now(),
            status: 'RUNNING',
        };

        this.activeTraces.set(traceId, metrics);
        this.logger.info('PhaseTracer', `Phase ${phase} started`, { traceId, agent });
        return traceId;
    }

    public endPhase(traceId: string, status: 'COMPLETED' | 'FAILED' | 'BLOCKED', details?: Partial<PhaseMetrics>): void {
        const metrics = this.activeTraces.get(traceId);
        if (!metrics) {
            this.logger.warn('PhaseTracer', `Trace ${traceId} not found.`);
            return;
        }

        metrics.endTime = Date.now();
        metrics.durationMs = metrics.endTime - metrics.startTime;
        metrics.status = status;
        if (details) Object.assign(metrics, details);

        this.activeTraces.delete(traceId);
        this.completedTraces.push(metrics);

        this.logger.info('PhaseTracer', `Phase ${metrics.phase} ${status} in ${metrics.durationMs}ms`, {
            traceId,
            agent: metrics.agent,
            durationMs: metrics.durationMs,
        });
    }

    public getActiveTraces(): PhaseMetrics[] {
        return Array.from(this.activeTraces.values());
    }

    public getCompletedTraces(): PhaseMetrics[] {
        return [...this.completedTraces];
    }

    public getSummary(): Record<string, any> {
        return {
            active: this.activeTraces.size,
            completed: this.completedTraces.length,
            failed: this.completedTraces.filter(t => t.status === 'FAILED').length,
            blocked: this.completedTraces.filter(t => t.status === 'BLOCKED').length,
            avgDurationMs: this.completedTraces.length > 0
                ? Math.round(
                    this.completedTraces.reduce((sum, t) => sum + (t.durationMs || 0), 0) /
                    this.completedTraces.length
                )
                : 0,
        };
    }
}
