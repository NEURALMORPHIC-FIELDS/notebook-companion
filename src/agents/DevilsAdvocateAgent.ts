/**
 * DevilsAdvocateAgent.ts — Pre-HITL contestation agent
 * NEXUS AI v6 — Devil's Advocate Agent (§4 ARCHITECTURE.md)
 *
 * ROLE: The only agent in NEXUS AI that generates nothing.
 * Its exclusive role: find what is wrong, incomplete, or merely apparent
 * in any other agent's output, before the user sees it.
 *
 * Evaluated on how many REAL problems it finds — not on how many it approves.
 * blocksApproval is determined by structured severity parsing, NOT substring match.
 */

import { BaseAgent, AgentOutput } from './BaseAgent';
import { ArchContradictionDetector } from '../behavioral/ArchContradictionDetector';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export interface ContestReport {
    contestedAgent: string;
    phase: string;
    issuesFound: number;
    critical: string[];
    high: string[];
    medium: string[];
    blocksApproval: boolean;
}

export class DevilsAdvocateAgent extends BaseAgent {
    public readonly role = 'devils-advocate';
    private contradictionDetector = new ArchContradictionDetector();

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const agentOutputToContest = context['agentOutput'] as AgentOutput;
        const phase = context.phase || 'UNKNOWN';

        if (!agentOutputToContest) {
            return { agentRole: this.role, phase, content: 'No output to contest.' };
        }

        const systemPrompt = this.buildSystemPrompt(phase);

        const llmResponse = await this.callLLM(
            `${systemPrompt}\n\n---\nAGENT: ${agentOutputToContest.agentRole}\nPHASE: ${agentOutputToContest.phase}\nOUTPUT:\n${agentOutputToContest.content}`,
            phase
        );

        // Parse structured severity — DO NOT use simple substring includes()
        const blocksApproval = this.parseHasCriticalIssues(llmResponse);
        const issueCount = this.countIssues(llmResponse);

        return {
            agentRole: this.role,
            phase: agentOutputToContest.phase,
            content: llmResponse,
            metadata: {
                blocksApproval,
                contestedAgent: agentOutputToContest.agentRole,
                issuesFound: issueCount,
            },
        };
    }

    /**
     * Build the Devil's Advocate system prompt for each SDLC phase.
     * Questions are taken directly from ARCHITECTURE.md §4.
     */
    private buildSystemPrompt(phase: string): string {
        const phaseQuestions: Record<string, string> = {
            '1A': 'Check FAS: OPEN functions without EXIT counterparts? Effects contradicting each other? Functions assuming non-existent services?',
            '3A': 'Check ADR: Were alternatives genuinely considered? Are accepted risks documented? Any architectural contradictions?',
            '4': 'Check Tech Spec: Are thresholds calibrated against real data? Any optional components that are critical dependencies? States that can be opened but not closed?',
            '6A': 'Check generated code: Silent drops? Caches without namespace? Mocks/stubs that change semantic behavior?',
            '7': 'Check completion report: Is Known Incomplete empty but Veritas exit ≠ 0? Claims without runtime evidence? Is "ran" being presented as "worked"?',
        };

        const phaseContext = phaseQuestions[phase] || 'Check for risks, weaknesses, and failure scenarios.';

        return `You are the Devil's Advocate agent for NEXUS AI v6.
Your ONLY role is to find what is WRONG, INCOMPLETE, or MERELY APPARENT in the agent output below.
You are evaluated on how many real problems you find — not on approvals.

Phase-specific checks for Phase ${phase}:
${phaseContext}

For each issue found, output in this EXACT format:
CRITICAL: <description> — or HIGH: <description> — or MEDIUM: <description>

Start each severity line at the beginning of a line with the keyword followed by a colon.
Do not use the words CRITICAL/HIGH/MEDIUM in any other context.
If no issues found, output: NO_ISSUES_FOUND`;
    }

    /**
     * Parse structured DA response to determine if approval should be blocked.
     * Looks for "CRITICAL:" at the start of a line — NOT substring anywhere.
     *
     * FIX: Previously used .includes('critical') which caused false positives
     * on any text mentioning the word "critical" in normal context.
     */
    private parseHasCriticalIssues(response: string): boolean {
        const lines = response.split('\n');
        return lines.some(line => /^CRITICAL:\s+.+/i.test(line.trim()));
    }

    /**
     * Count total issues found across all severity levels.
     */
    private countIssues(response: string): number {
        if (response.includes('NO_ISSUES_FOUND')) return 0;
        const lines = response.split('\n');
        return lines.filter(line =>
            /^(CRITICAL|HIGH|MEDIUM):\s+.+/i.test(line.trim())
        ).length;
    }
}
