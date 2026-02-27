import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';
import { SilentDropMonitor } from '../behavioral/SilentDropMonitor';

export class CodeReviewerAgent extends BaseAgent {
    public readonly role = 'code-reviewer';
    private dropMonitor = new SilentDropMonitor('code-reviewer');

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';

        if (phase === '7') {
            const llmResponse = await this.callLLM(
                `Review the following code/output for phase ${phase}. Check: coding standards, code smells, duplication, complexity, test coverage.\n\n${input}`,
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
        return {
            agentRole: this.role,
            phase,
            content: llmResponse,
        };
    }
}
