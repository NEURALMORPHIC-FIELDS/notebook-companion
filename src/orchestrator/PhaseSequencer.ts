/**
 * PhaseSequencer.ts — Automatic phase-to-phase advance engine
 * NEXUS AI v6 — ARCHITECTURE.md §5 + §8
 *
 * WHAT THIS DOES:
 *   After a user approves Phase N in HITL, PhaseSequencer automatically
 *   triggers Phase N+1 with the correct input derived from Phase N output.
 *
 * ARCHITECTURE.md phase flow (horizontal pipeline):
 *   0 → 1A → 1B → 2 → 3A → 3B → 4 → 5 → 6A → 6B → 7 → 8 → 9 → 10 → 11
 *
 * Data piping rules (per ARCHITECTURE.md):
 *   1A output (FAS)        → feeds 1B, 2, 3A, 5
 *   1B output (PRD)        → feeds 2, 3A
 *   3A output (ADR)        → feeds 4
 *   4  output (TechSpec)   → feeds 5, 6A
 *   5  output (WBS)        → feeds 6A
 *   6A output (Code)       → feeds 7, 9
 *   7  output (Review)     → feeds 8
 */

export interface PhaseOutput {
    phase: string;
    content: string;
    approvedAt: string;
}

/** Phases that require HITL before next phase starts */
const HITL_REQUIRED = new Set([
    '1A', '1B', '2', '3A', '3B', '4', '5', '6A', '7', '8', '9', '10', '11'
]);

/** Ordered chain of SDLC phases */
const PHASE_CHAIN: string[] = [
    '1A', '1B', '2', '3A', '3B', '4', '5', '6A', '6B', '7', '8', '9', '10', '11'
];

const STORAGE_KEY = 'nexus-phase-outputs';

export class PhaseSequencer {
    private phaseOutputs: Map<string, PhaseOutput> = new Map();
    private onStartNextPhase: (phase: string, input: string) => Promise<void>;
    private onBlockPhase: (phase: string, reason: string) => void;

    constructor(
        onStartNextPhase: (phase: string, input: string) => Promise<void>,
        onBlockPhase: (phase: string, reason: string) => void,
    ) {
        this.onStartNextPhase = onStartNextPhase;
        this.onBlockPhase = onBlockPhase;
        this.loadOutputs();
    }

    /**
     * Called by OrchestratorStore when a phase completes successfully.
     * Stores the output for use as input to the next phase.
     */
    public recordPhaseOutput(phase: string, content: string): void {
        const record: PhaseOutput = {
            phase,
            content,
            approvedAt: new Date().toISOString(),
        };
        this.phaseOutputs.set(phase, record);
        this.persistOutputs();
        console.info(`[PhaseSequencer] Output recorded for Phase ${phase} (${content.length} chars)`);
    }

    /**
     * Called by OrchestratorStore.resolveApproval() when user clicks APPROVE.
     * Determines next phase and auto-starts it with correct input.
     *
     * This is the core of the horizontal pipeline:
     *   User approves Phase N → PhaseSequencer.onApproved(N, output)
     *     → buildNextInput(N+1) → onStartNextPhase(N+1, input)
     */
    public async onApproved(approvedPhase: string, phaseOutput: string): Promise<void> {
        // Store the approved output
        this.recordPhaseOutput(approvedPhase, phaseOutput);

        // Find next phase in chain
        const nextPhase = this.getNextPhase(approvedPhase);
        if (!nextPhase) {
            console.info(`[PhaseSequencer] Phase ${approvedPhase} is the final phase. Pipeline complete.`);
            return;
        }

        // Build context input for next phase from accumulated outputs
        const nextInput = this.buildNextInput(nextPhase);

        console.info(`[PhaseSequencer] Phase ${approvedPhase} approved → auto-starting Phase ${nextPhase}`);

        try {
            await this.onStartNextPhase(nextPhase, nextInput);
        } catch (err) {
            const reason = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[PhaseSequencer] Failed to start Phase ${nextPhase}:`, reason);
            this.onBlockPhase(nextPhase, reason);
        }
    }

    /**
     * Build the LLM input string for a given phase by combining relevant
     * approved outputs from preceding phases.
     *
     * Per ARCHITECTURE.md — each phase receives only the artifacts it needs:
     *   Phase 1B needs: FAS (1A)
     *   Phase 3A needs: FAS + PRD (1A + 1B)
     *   Phase 4  needs: ADR (3A)
     *   Phase 6A needs: TechSpec + WBS (4 + 5)
     *   etc.
     */
    public buildNextInput(phase: string): string {
        const get = (p: string) => this.phaseOutputs.get(p)?.content ?? '';

        switch (phase) {
            case '1B':
                return this.wrap('FAS (Phase 1A)', get('1A'))
                    + '\n\nBased on the FAS above, generate the full PRD and User Stories.';

            case '2':
                return this.wrap('FAS (Phase 1A)', get('1A'))
                    + this.wrap('PRD (Phase 1B)', get('1B'))
                    + '\n\nBased on the FAS and PRD above, define the optimal team configuration and agent assignments.';

            case '3A':
                return this.wrap('FAS (Phase 1A)', get('1A'))
                    + this.wrap('PRD (Phase 1B)', get('1B'))
                    + this.wrap('Team Assembly (Phase 2)', get('2'))
                    + '\n\nGenerate the Architecture Decision Record (ADR) and system component specs. Validate all OPEN/CLOSE pairs from the FAS.';

            case '3B':
                return this.wrap('FAS (Phase 1A)', get('1A'))
                    + this.wrap('PRD (Phase 1B)', get('1B'))
                    + '\n\nGenerate the Brand Identity Guidelines and Design System tokens.';

            case '4':
                return this.wrap('ADR (Phase 3A)', get('3A'))
                    + this.wrap('FAS (Phase 1A)', get('1A'))
                    + '\n\nGenerate the full Technical Specification. Document every threshold with its calibration_basis. No magic constants.';

            case '5':
                return this.wrap('FAS (Phase 1A)', get('1A'))
                    + this.wrap('Technical Spec (Phase 4)', get('4'))
                    + '\n\nGenerate the Work Breakdown Structure. One task per FAS function (T-XXX maps to F-XXX).';

            case '6A':
                return this.wrap('Technical Spec (Phase 4)', get('4'))
                    + this.wrap('WBS (Phase 5)', get('5'))
                    + this.wrap('ADR (Phase 3A)', get('3A'))
                    + '\n\nImplement the backend and frontend code per the technical spec. Follow all architectural decisions.';

            case '6B':
                return this.wrap('Design System (Phase 3B)', get('3B'))
                    + this.wrap('FAS (Phase 1A)', get('1A'))
                    + '\n\nGenerate all required assets (icons, images) per the design system tokens.';

            case '7':
                return this.wrap('Implementation (Phase 6A)', get('6A'))
                    + this.wrap('Technical Spec (Phase 4)', get('4'))
                    + '\n\nPerform a full code review. Check for: silent drops, unclosed states, missing error handling, architectural violations.';

            case '8':
                return this.wrap('Code Review (Phase 7)', get('7'))
                    + this.wrap('Technical Spec (Phase 4)', get('4'))
                    + '\n\nGenerate the QA test plan and test cases. Verify each FAS function has a corresponding test.';

            case '9':
                return this.wrap('Implementation (Phase 6A)', get('6A'))
                    + this.wrap('Code Review (Phase 7)', get('7'))
                    + '\n\nConduct a full OWASP security audit. Check authentication, authorization, input validation, data exposure.';

            case '10':
                return this.wrap('FAS (Phase 1A)', get('1A'))
                    + this.wrap('ADR (Phase 3A)', get('3A'))
                    + this.wrap('Technical Spec (Phase 4)', get('4'))
                    + this.wrap('Code Review (Phase 7)', get('7'))
                    + '\n\nGenerate the complete technical documentation: API reference, architecture overview, developer guide.';

            case '11':
                return this.wrap('Technical Spec (Phase 4)', get('4'))
                    + this.wrap('Implementation (Phase 6A)', get('6A'))
                    + this.wrap('Security Audit (Phase 9)', get('9'))
                    + '\n\nGenerate the CI/CD pipeline configuration, infrastructure-as-code, and deployment runbook.';

            default:
                // Generic fallback: use the immediately preceding phase output
                const prevPhase = PHASE_CHAIN[PHASE_CHAIN.indexOf(phase) - 1];
                return prevPhase ? get(prevPhase) : 'Begin this phase.';
        }
    }

    /** Get the next phase in the chain, or null if this is the last. */
    public getNextPhase(currentPhase: string): string | null {
        const idx = PHASE_CHAIN.indexOf(currentPhase);
        if (idx === -1 || idx === PHASE_CHAIN.length - 1) return null;
        return PHASE_CHAIN[idx + 1];
    }

    /** Get all stored phase outputs — used by VeritasDashboard and NEXUS.md generation. */
    public getPhaseOutputs(): Map<string, PhaseOutput> {
        return new Map(this.phaseOutputs);
    }

    /** Reset sequencer state (new project). */
    public reset(): void {
        this.phaseOutputs.clear();
        localStorage.removeItem(STORAGE_KEY);
    }

    private wrap(label: string, content: string): string {
        if (!content) return '';
        return `\n\n---\n## ${label}\n\n${content}`;
    }

    private persistOutputs(): void {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(Object.fromEntries(this.phaseOutputs))
            );
        } catch { /* storage full — continue without persistence */ }
    }

    private loadOutputs(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const obj = JSON.parse(raw) as Record<string, PhaseOutput>;
            for (const [phase, output] of Object.entries(obj)) {
                this.phaseOutputs.set(phase, output);
            }
            console.info(`[PhaseSequencer] Restored ${this.phaseOutputs.size} phase outputs from storage.`);
        } catch { /* corrupt storage — start fresh */ }
    }
}
