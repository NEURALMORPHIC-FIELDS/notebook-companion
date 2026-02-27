import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class UIUXDesignerAgent extends BaseAgent {
    public readonly role = 'uiux-designer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '3B'
                ? `Creează design system pentru: "${input}". Include: spacing scale, breakpoints, component library, accessibility (WCAG AA), user flows.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
