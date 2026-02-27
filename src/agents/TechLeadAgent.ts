import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class TechLeadAgent extends BaseAgent {
    public readonly role = 'tech-lead';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';

        if (phase === '4') {
            const llmResponse = await this.callLLM(
                `Generează Tech Spec pentru: "${input}". Include: tech stack, coding standards, thresholds calibrate, task breakdown, estimări complexitate.`,
                phase
            );
            return {
                agentRole: this.role,
                phase,
                content: llmResponse,
                metadata: { requiresDA: true },
            };
        }

        const llmResponse = await this.callLLM(input, phase);
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
