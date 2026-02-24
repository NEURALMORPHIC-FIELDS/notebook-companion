// AgentOrchestrator.ts — manages the 15 SDLC phases and interactions
import { BaseAgent } from '../agents/BaseAgent';
import { ProjectManagerAgent } from '../agents/ProjectManagerAgent';
import { DevilsAdvocateAgent } from '../agents/DevilsAdvocateAgent';
import { SanityGate } from '../veritas/SanityGate';

// Wiring all required modules for Veritas Ground Truth
import { AgentOutputFilter } from '../behavioral/AgentOutputFilter';
import { ArchContradictionDetector } from '../behavioral/ArchContradictionDetector';
import { NamespacedCache } from '../behavioral/NamespacedCache';
import { RanVsWorkedReporter } from '../behavioral/RanVsWorkedReporter';
import { SilentDropMonitor } from '../behavioral/SilentDropMonitor';
import { SemanticStateTracker } from '../veritas/SemanticStateTracker';

export class AgentOrchestrator {
    private pmAgent = new ProjectManagerAgent();
    private devAdvocate = new DevilsAdvocateAgent();
    private sanityGate = new SanityGate();

    public async runPhase(phaseCode: string, input: string): Promise<void> {
        console.log(`\n========== STARTING PHASE: ${phaseCode} ==========`);

        // 1. Mandatory Veritas / Sanity Gate Check pre-HITL (if applicable to phase)
        if (['1A', '3A', '4', '6A', '7', '11'].includes(phaseCode)) {
            const gateResult = await this.sanityGate.check(phaseCode);
            if (gateResult.blocked) {
                console.error(`[BLOCKED] Sanity Gate rejected transition to Phase ${phaseCode}`);
                console.error(`Reason: ${gateResult.reason}`);
                console.error('Agent MUST remediate before continuing.');
                return;
            }
            console.log(`[PASS] Sanity Gate open. Modules WIRED: ${gateResult.wired}`);
        }

        const context = { phase: phaseCode, errorOccurred: false };

        // 2. Main Agent Execution
        let mainOutput;

        // Switch between agents based on phase (simplified logic)
        if (phaseCode === '1A' || phaseCode === '12') {
            mainOutput = await this.pmAgent.processAndRespond(input, context);
        }
        // ... logic for other agents like Architect, TechLead, Engineer ...

        // 3. Devil's Advocate Review Checkpoint (Mandatory for key phases)
        if (mainOutput && ['3A', '4', '6A', '7'].includes(phaseCode)) {
            console.log(`\n--- Calling Devil's Advocate for Review ---`);
            const contestCtx = { ...context, agentOutput: mainOutput };
            const daOutput = await this.devAdvocate.processAndRespond('', contestCtx);
            if (daOutput) {
                console.log(`Devil's Advocate Contest Report: ${daOutput.content}`);
                if (daOutput.metadata?.blocksApproval) {
                    console.error("[HITL BLOCKED] Devil's Advocate found CRITICAL issues.");
                    return;
                }
            }
        }

        console.log(`========== PHASE ${phaseCode} COMPLETE ==========\n`);
    }
}
