import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';
import { RanVsWorkedReporter } from '../behavioral/RanVsWorkedReporter';

export class FrontendEngineerAgent extends BaseAgent {
    public readonly role = 'frontend-engineer';
    private reporter = new RanVsWorkedReporter();

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        const result = {
            agentRole: this.role,
            phase,
            content: `[Frontend] Building UI components for phase ${phase}.`,
            metadata: {
                componentsCreated: [] as string[],
                componentsModified: [] as string[],
                designSystemCompliant: true,
            },
        };

        this.reporter.report({
            agent: this.role,
            phase,
            ran: true,
            worked: false,
            details: 'Frontend scaffolding — awaiting design system tokens',
        });

        return result;
    }
}
