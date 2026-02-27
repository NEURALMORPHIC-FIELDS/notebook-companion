import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class BrandDesignerAgent extends BaseAgent {
    public readonly role = 'brand-designer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '3B'
                ? `Create a brand guide for: "${input}". Include: color palette (hex + semantic tokens), typography, visual direction, and mood board.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
