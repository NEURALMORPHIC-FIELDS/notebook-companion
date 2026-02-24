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
        // This agent doesn't "respond" to user input playfully; 
        // it analyzes another agent's output provided in the context.
        const agentOutputToContest = context['agentOutput'] as AgentOutput;

        if (!agentOutputToContest) {
            return { agentRole: this.role, phase: context['phase'] || 'UNKNOWN', content: 'No output to contest.' };
        }

        const report = await this.contest(agentOutputToContest, context);

        return {
            agentRole: this.role,
            phase: agentOutputToContest.phase,
            content: `Found ${report.issuesFound} issues in ${agentOutputToContest.agentRole}'s output.`,
            metadata: report
        };
    }

    public async contest(agentOutput: AgentOutput, context: AgentContext): Promise<ContestReport> {
        // Mock checks that would normally parse the AST/Output
        const checks = await Promise.all([
            this.checkOpenWithoutClose(agentOutput, context),
            this.checkSilentDrops(agentOutput, context),
            this.checkGlobalCaches(agentOutput, context),
            this.checkUncalibratedThresholds(agentOutput, context),
            this.checkBlindFeedbackLoops(agentOutput, context),
            this.checkStubSemanticChanges(agentOutput, context),
            this.checkRanVsWorked(agentOutput, context),
            this.checkKnownIncompleteConsistency(agentOutput, context),
        ]);

        const issues = checks.flat().filter(Boolean);

        return {
            contestedAgent: agentOutput.agentRole,
            phase: agentOutput.phase,
            issuesFound: issues.length,
            critical: issues.filter(i => i && i.severity === 'CRITICAL'),
            warnings: issues.filter(i => i && i.severity === 'HIGH'),
            blocksApproval: issues.some(i => i && i.severity === 'CRITICAL'),
        };
    }

    // --- Mock Analysis Methods (returning null means no issue found) ---

    private async checkOpenWithoutClose(output: AgentOutput, ctx: any): Promise<any> { return null; }
    private async checkSilentDrops(output: AgentOutput, ctx: any): Promise<any> { return null; }
    private async checkGlobalCaches(output: AgentOutput, ctx: any): Promise<any> { return null; }
    private async checkUncalibratedThresholds(output: AgentOutput, ctx: any): Promise<any> { return null; }
    private async checkBlindFeedbackLoops(output: AgentOutput, ctx: any): Promise<any> { return null; }
    private async checkStubSemanticChanges(output: AgentOutput, ctx: any): Promise<any> { return null; }

    private async checkRanVsWorked(output: AgentOutput, ctx: any): Promise<any> {
        // e.g. checking if "known_incomplete" is suspiciously empty
        if (output.metadata?.known_incomplete?.length === 0 && output.metadata?.veritas_exit_code !== 0) {
            return { severity: 'CRITICAL', description: "Report claims to be complete but Veritas failed." };
        }
        return null;
    }

    private async checkKnownIncompleteConsistency(output: AgentOutput, ctx: any): Promise<any> { return null; }
}
