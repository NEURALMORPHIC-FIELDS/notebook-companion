import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class BrandDesignerAgent extends BaseAgent {
    public readonly role = 'brand-designer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '3B'
                ? `Creează brand guide pentru: "${input}". Include: paletă de culori (hex + semantic tokens), tipografie, direcție vizuală, mood board.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
