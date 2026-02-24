import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class TechWriterAgent extends BaseAgent {
    public readonly role = 'tech-writer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '10'
                ? `Generează documentație pentru: "${input}". Include: README, API docs, changelog, ghid de utilizare.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
