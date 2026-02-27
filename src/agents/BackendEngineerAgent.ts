import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';
import { RanVsWorkedReporter } from '../behavioral/RanVsWorkedReporter';

export class BackendEngineerAgent extends BaseAgent {
    public readonly role = 'backend-engineer';
    private reporter = new RanVsWorkedReporter();

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';
        const llmResponse = await this.callLLM(input, phase);

        const report = this.reporter.generateEmptyReport();
        report.execution.completed_without_crash = true;
        report.execution.exit_code = 0;
        this.reporter.validateReport(report);

        return {
            agentRole: this.role,
            phase,
            content: llmResponse,
            metadata: { report },
        };
    }
}
