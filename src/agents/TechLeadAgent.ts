import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class TechLeadAgent extends BaseAgent {
    public readonly role = 'tech-lead';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        if (phase === '4') {
            const techSpec = this.generateTechSpec(input);
            return {
                agentRole: this.role,
                phase,
                content: `[TechLead] Tech Spec generated with ${techSpec.thresholds.length} calibrated thresholds.`,
                metadata: { techSpec, requiresDA: true },
            };
        }

        return {
            agentRole: this.role,
            phase,
            content: `[TechLead] Standards review for phase ${phase}.`,
        };
    }

    private generateTechSpec(input: string): Record<string, any> {
        return {
            title: `Tech Spec — ${input.substring(0, 40)}`,
            standards: ['TypeScript strict mode', 'ESLint enforced', 'Atomic writes for persistence'],
            thresholds: [
                { metric: 'response_time_ms', max: 200, calibrated: true },
                { metric: 'error_rate_pct', max: 0.1, calibrated: true },
                { metric: 'coverage_pct', min: 80, calibrated: true },
            ],
            timestamp: new Date().toISOString(),
        };
    }
}
