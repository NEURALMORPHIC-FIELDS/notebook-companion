import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class QAEngineerAgent extends BaseAgent {
    public readonly role = 'qa-engineer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '8'
                ? `Generate a complete test plan for: "${input}". Include: test cases, edge cases, coverage targets, and mapping to FAS functions.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
