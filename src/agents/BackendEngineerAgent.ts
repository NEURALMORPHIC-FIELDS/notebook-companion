import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';
import { RanVsWorkedReporter } from '../behavioral/RanVsWorkedReporter';

export class BackendEngineerAgent extends BaseAgent {
    public readonly role = 'backend-engineer';
    private reporter = new RanVsWorkedReporter();

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        const result = {
            agentRole: this.role,
            phase,
            content: `[Backend] Implementing server-side logic for phase ${phase}.`,
            metadata: {
                filesCreated: [] as string[],
                filesModified: [] as string[],
                testsRun: false,
                testsPass: false,
                veritasExitCode: -1,
            },
        };

        // Rule #2: Ran ≠ Worked — always report both
        this.reporter.report({
            agent: this.role,
            phase,
            ran: true,
            worked: false,
            details: 'Backend scaffolding — awaiting LLM adapter integration',
        });

        return result;
    }
}
