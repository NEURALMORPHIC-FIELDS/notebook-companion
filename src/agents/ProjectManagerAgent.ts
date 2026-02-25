/**
 * ProjectManagerAgent.ts — PM Agent: FAS generation + SDLC management
 * NEXUS AI v6 — Project Manager Agent (§5, §7 ARCHITECTURE.md)
 *
 * Responsibilities per ARCHITECTURE.md §5:
 *   Phase 0  — Onboarding + NEXUS.md generation
 *   Phase 1A — FAS generation with OPEN/CLOSE pair validation
 *   Phase 1B — PRD + User Stories
 *   Phase 2  — Team Assembly
 *   Phase 5  — WBS (1 task per FAS function)
 *   Phase 12 — Maintenance Guide synthesis
 *
 * CORE RULE (§7): Any function that opens a state MUST have a documented
 * CLOSE counterpart. PM blocks Phase 1A until all OPEN/CLOSE pairs exist.
 */

import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class ProjectManagerAgent extends BaseAgent {
    public readonly role = 'project-manager';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = (context['phase'] as string) || 'UNKNOWN';
        const llmResponse = await this.callLLM(this.buildPrompt(phase, input), phase);

        return {
            agentRole: this.role,
            phase,
            content: llmResponse,
            metadata: this.buildMetadata(phase),
        };
    }

    /**
     * Build phase-specific system + user prompt.
     * All prompts are in English (configurable via NEXUS_LANGUAGE in future).
     */
    private buildPrompt(phase: string, input: string): string {
        switch (phase) {
            case '1A':
                return `You are the NEXUS AI Project Manager. Generate a Functional Architecture Sheet (FAS) for the following requirement.

REQUIREMENT:
"${input}"

For each function, document it in this exact format:

**F-XXX** — Function Name
• user_value: What the user receives (no technical jargon)
• system_effect: [OPEN|CLOSE|NEUTRAL] + list of technical side effects
• required_services: [list of abstract services required, no implementation details]
• close_pair: F-YYY (MANDATORY if system_effect = OPEN — the closing function ID)
• dependencies: [F-ZZZ] (prerequisite functions)
• verification_mechanism: How the system confirms this function produced the correct effect
• priority: critical | high | medium | low
• constraints: Business rules that apply to this function

RULES:
- Identify a minimum of 5 functions.
- Every OPEN function MUST have a documented CLOSE pair. Missing close_pair = architectural contradiction.
- Every verification_mechanism is MANDATORY — a function without one is a blind feedback loop.
- At the end, list all required_services aggregated across all functions.`;

            case '1B':
                return `You are the NEXUS AI Project Manager in Phase 1B — Discovery & PRD.
Based on this project context, generate:
1. A full Product Requirements Document (PRD) with Executive Summary, Problem Statement, Goals & Non-Goals.
2. User Stories in format: "As a [persona], I want [action] so that [outcome]."
3. Acceptance Criteria for each User Story.

PROJECT CONTEXT:
"${input}"`;

            case '2':
                return `You are the NEXUS AI Project Manager in Phase 2 — Team Assembly.
Based on the project requirements below, define the optimal team configuration:
- Which specialized agents are needed
- Which LLM model is best suited for each agent role and why
- Estimated effort per agent per phase

PROJECT CONTEXT:
"${input}"`;

            case '5':
                return `You are the NEXUS AI Project Manager in Phase 5 — Work Breakdown Structure.
Generate a detailed WBS with exactly one task per FAS function. Each task must include:
- Task ID (T-XXX matching FAS F-XXX)
- Description
- Responsible agent
- Estimated effort (hours)
- Dependencies (D: T-YYY)
- Deliverable artifact

FAS CONTEXT:
"${input}"`;

            case '12':
                return `You are the NEXUS AI Project Manager in Phase 12 — Maintenance & Handover.
Synthesize all project documentation into the MAINTENANCE_GUIDE.md. Include all 12 mandatory sections:
1. Executive Summary, 2. Architecture Deep Dive, 3. Module Map, 4. Database & Data Management,
5. API Reference, 6. Operations Manual, 7. Monitoring & Incident Response, 8. Testing Guide,
9. Security Guidelines, 10. Design System Maintenance, 11. Developer Onboarding,
12. Tech Debt & Known Incomplete.

PROJECT DOCUMENTATION:
"${input}"`;

            default:
                return `You are the NEXUS AI Project Manager in Phase ${phase}.
Process the following request and respond with structured, actionable output:

"${input}"`;
        }
    }

    private buildMetadata(phase: string): Record<string, unknown> {
        return {
            type: phase === '1A' ? 'FAS' : phase === '1B' ? 'PRD' : 'PHASE_OUTPUT',
            generatedAt: new Date().toISOString(),
            phase,
        };
    }
}
