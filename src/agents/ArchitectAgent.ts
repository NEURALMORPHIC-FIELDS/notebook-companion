import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';
import { ArchContradictionDetector, Contradiction } from '../behavioral/ArchContradictionDetector';

export class ArchitectAgent extends BaseAgent {
    public readonly role = 'architect';
    private contradictionDetector = new ArchContradictionDetector();

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';

        if (phase === '3A') {
            const llmResponse = await this.callLLM(
                `Generează un Architecture Decision Record (ADR) pentru: "${input}". Include: Context, Decision, Consequences, Trade-offs.`,
                phase
            );
            const contradictions = this.contradictionDetector.analyze([], []);
            return {
                agentRole: this.role,
                phase,
                content: llmResponse,
                metadata: { contradictions, requiresDA: true },
            };
        }

        const llmResponse = await this.callLLM(input, phase);
        return {
            agentRole: this.role,
            phase,
            content: llmResponse,
        };
    }
}
