import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';
import { SilentDropMonitor } from '../behavioral/SilentDropMonitor';

export class CodeReviewerAgent extends BaseAgent {
    public readonly role = 'code-reviewer';
    private dropMonitor = new SilentDropMonitor();

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        if (phase === '7') {
            const reviewReport = this.performReview(input);
            // Rule #3: Zero silent drops — log any skipped files
            if (reviewReport.skippedFiles.length > 0) {
                this.dropMonitor.recordDrop({
                    agent: this.role,
                    phase,
                    droppedItems: reviewReport.skippedFiles,
                    reason: 'Files exceeded review context window',
                });
            }
            return {
                agentRole: this.role,
                phase,
                content: `[CodeReview] Reviewed ${reviewReport.filesReviewed} files. ${reviewReport.issues} issues found. ${reviewReport.skippedFiles.length} files skipped.`,
                metadata: { reviewReport, requiresDA: true },
            };
        }

        return {
            agentRole: this.role,
            phase,
            content: `[CodeReview] Standing by for phase ${phase} review.`,
        };
    }

    private performReview(_input: string): Record<string, any> {
        return {
            filesReviewed: 0,
            issues: 0,
            critical: 0,
            suggestions: 0,
            skippedFiles: [] as string[],
            knownIncomplete: [] as string[],
            timestamp: new Date().toISOString(),
        };
    }
}
