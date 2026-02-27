import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class QAEngineerAgent extends BaseAgent {
    public readonly role = 'qa-engineer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '8'
                ? `Generează test plan complet pentru: "${input}". Include: test cases, edge cases, coverage targets, mapping la funcții FAS.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
