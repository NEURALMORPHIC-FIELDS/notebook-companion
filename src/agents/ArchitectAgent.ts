import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';
import { ArchContradictionDetector, ContradictionReport } from '../behavioral/ArchContradictionDetector';

export class ArchitectAgent extends BaseAgent {
    public readonly role = 'architect';
    private contradictionDetector = new ArchContradictionDetector();

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        if (phase === '3A') {
            const adr = this.generateADR(input);
            const contradictions = this.contradictionDetector.analyze(adr);
            return {
                agentRole: this.role,
                phase,
                content: `[Architect] ADR generated. ${contradictions.issues.length} architectural contradictions detected.`,
                metadata: { adr, contradictions, requiresDA: true },
            };
        }

        return {
            agentRole: this.role,
            phase,
            content: `[Architect] Analyzing architecture for phase ${phase}: ${input.substring(0, 50)}...`,
        };
    }

    private generateADR(input: string): Record<string, any> {
        return {
            title: `ADR — ${input.substring(0, 40)}`,
            status: 'PROPOSED',
            context: input,
            decision: 'Pending architectural review',
            consequences: [],
            timestamp: new Date().toISOString(),
        };
    }
}
