import { BaseAgent, AgentOutput } from './BaseAgent';
import { ArchContradictionDetector } from '../behavioral/ArchContradictionDetector';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export interface ContestReport {
    contestedAgent: string;
    phase: string;
    issuesFound: number;
    critical: any[];
    warnings: any[];
    blocksApproval: boolean;
}

export class DevilsAdvocateAgent extends BaseAgent {
    public readonly role = 'devils-advocate';
    private contradictionDetector = new ArchContradictionDetector();

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const agentOutputToContest = context['agentOutput'] as AgentOutput;
        const phase = context['phase'] || 'UNKNOWN';

        if (!agentOutputToContest) {
            return { agentRole: this.role, phase, content: 'No output to contest.' };
        }

        // Call LLM for deep analysis
        const llmResponse = await this.callLLM(
            `Analizează critic următorul output al agentului "${agentOutputToContest.agentRole}" din faza ${agentOutputToContest.phase}. Identifică riscuri, puncte slabe, scenarii de eșec. Dă severity rating (CRITICAL/HIGH/MEDIUM) pentru fiecare problemă.\n\nOutput:\n${agentOutputToContest.content}`,
            phase
        );

        const blocksApproval = llmResponse.toLowerCase().includes('critical');

        return {
            agentRole: this.role,
            phase: agentOutputToContest.phase,
            content: llmResponse,
            metadata: { blocksApproval },
        };
    }
}
