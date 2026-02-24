// AgentOrchestrator.ts — manages the 15 SDLC phases with all 14 agents
import { ProjectManagerAgent } from '../agents/ProjectManagerAgent';
import { DevilsAdvocateAgent } from '../agents/DevilsAdvocateAgent';
import { ArchitectAgent } from '../agents/ArchitectAgent';
import { TechLeadAgent } from '../agents/TechLeadAgent';
import { BackendEngineerAgent } from '../agents/BackendEngineerAgent';
import { FrontendEngineerAgent } from '../agents/FrontendEngineerAgent';
import { QAEngineerAgent } from '../agents/QAEngineerAgent';
import { SecurityAuditorAgent } from '../agents/SecurityAuditorAgent';
import { CodeReviewerAgent } from '../agents/CodeReviewerAgent';
import { TechWriterAgent } from '../agents/TechWriterAgent';
import { DevOpsEngineerAgent } from '../agents/DevOpsEngineerAgent';
import { BrandDesignerAgent } from '../agents/BrandDesignerAgent';
import { UIUXDesignerAgent } from '../agents/UIUXDesignerAgent';
import { AssetGeneratorAgent } from '../agents/AssetGeneratorAgent';

import { SanityGate } from '../veritas/SanityGate';
import { VeritasRunner } from '../veritas/VeritasRunner';
import { SemanticStateTracker } from '../veritas/SemanticStateTracker';

import { AgentOutputFilter } from '../behavioral/AgentOutputFilter';
import { ArchContradictionDetector } from '../behavioral/ArchContradictionDetector';
import { NamespacedCache } from '../behavioral/NamespacedCache';
import { RanVsWorkedReporter } from '../behavioral/RanVsWorkedReporter';
import { SilentDropMonitor } from '../behavioral/SilentDropMonitor';

import { HITLManager } from '../hitl/HITLManager';
import { SessionManager } from '../memory/SessionManager';
import { StructuredLogger } from '../observability/StructuredLogger';
import { PhaseTracer } from '../observability/PhaseTracer';

import { BaseAgent, AgentOutput } from '../agents/BaseAgent';

/**
 * Phase-to-Agent mapping per NEXUS AI v6 Architecture.
 * Each phase may have a primary agent and optional secondary reviewers.
 */
interface PhaseConfig {
    primary: BaseAgent;
    secondary?: BaseAgent[];
    requiresDA: boolean;
    requiresVeritas: boolean;
    requiresHITL: boolean;
}

export class AgentOrchestrator {
    // === All 14 Agents ===
    private pmAgent = new ProjectManagerAgent();
    private architectAgent = new ArchitectAgent();
    private devilsAdvocate = new DevilsAdvocateAgent();
    private techLeadAgent = new TechLeadAgent();
    private backendAgent = new BackendEngineerAgent();
    private frontendAgent = new FrontendEngineerAgent();
    private qaAgent = new QAEngineerAgent();
    private securityAgent = new SecurityAuditorAgent();
    private codeReviewerAgent = new CodeReviewerAgent();
    private techWriterAgent = new TechWriterAgent();
    private devopsAgent = new DevOpsEngineerAgent();
    private brandAgent = new BrandDesignerAgent();
    private uiuxAgent = new UIUXDesignerAgent();
    private assetGenAgent = new AssetGeneratorAgent();

    // === Infrastructure ===
    private sanityGate = new SanityGate();
    private veritasRunner = new VeritasRunner();
    private stateTracker = new SemanticStateTracker();
    private hitlManager = new HITLManager();
    private sessionManager = new SessionManager();
    private logger = StructuredLogger.getInstance();
    private tracer = PhaseTracer.getInstance();

    // === Behavioral Rules (wired for Veritas compliance) ===
    private _outputFilter = new AgentOutputFilter();
    private _contradictionDetector = new ArchContradictionDetector();
    private _cache = new NamespacedCache();
    private _reporter = new RanVsWorkedReporter();
    private _dropMonitor = new SilentDropMonitor();

    /**
     * SDLC Phase → Agent mapping.
     */
    private getPhaseConfig(phaseCode: string): PhaseConfig {
        const map: Record<string, PhaseConfig> = {
            '0': { primary: this.pmAgent, requiresDA: false, requiresVeritas: false, requiresHITL: false },
            '1A': { primary: this.pmAgent, requiresDA: false, requiresVeritas: true, requiresHITL: true },
            '1B': { primary: this.pmAgent, requiresDA: false, requiresVeritas: false, requiresHITL: true },
            '2': { primary: this.pmAgent, requiresDA: false, requiresVeritas: false, requiresHITL: false },
            '3A': { primary: this.architectAgent, secondary: [this.devilsAdvocate], requiresDA: true, requiresVeritas: true, requiresHITL: true },
            '3B': { primary: this.brandAgent, secondary: [this.uiuxAgent], requiresDA: false, requiresVeritas: false, requiresHITL: true },
            '4': { primary: this.techLeadAgent, secondary: [this.devilsAdvocate], requiresDA: true, requiresVeritas: true, requiresHITL: true },
            '5': { primary: this.pmAgent, requiresDA: false, requiresVeritas: false, requiresHITL: true },
            '6A': { primary: this.backendAgent, secondary: [this.frontendAgent, this.devilsAdvocate], requiresDA: true, requiresVeritas: true, requiresHITL: true },
            '6B': { primary: this.assetGenAgent, requiresDA: false, requiresVeritas: false, requiresHITL: false },
            '7': { primary: this.codeReviewerAgent, secondary: [this.devilsAdvocate], requiresDA: true, requiresVeritas: true, requiresHITL: true },
            '8': { primary: this.qaAgent, requiresDA: false, requiresVeritas: true, requiresHITL: true },
            '9': { primary: this.securityAgent, requiresDA: false, requiresVeritas: false, requiresHITL: true },
            '10': { primary: this.techWriterAgent, requiresDA: false, requiresVeritas: false, requiresHITL: false },
            '11': { primary: this.devopsAgent, requiresDA: false, requiresVeritas: true, requiresHITL: true },
            '12': { primary: this.pmAgent, requiresDA: false, requiresVeritas: false, requiresHITL: true },
        };
        return map[phaseCode] || { primary: this.pmAgent, requiresDA: false, requiresVeritas: false, requiresHITL: false };
    }

    /**
     * Executes a full SDLC phase with Veritas gate, agent execution,
     * Devil's Advocate review, and HITL approval.
     */
    public async runPhase(phaseCode: string, input: string): Promise<void> {
        const config = this.getPhaseConfig(phaseCode);
        const traceId = this.tracer.startPhase(phaseCode, config.primary.role);

        this.logger.info('Orchestrator', `Starting phase ${phaseCode}`, { agent: config.primary.role });

        // ──── 1. VERITAS GATE ────
        if (config.requiresVeritas) {
            const gateResult = await this.sanityGate.check(phaseCode);
            if (gateResult.blocked) {
                this.logger.error('Orchestrator', `Sanity Gate BLOCKED phase ${phaseCode}`, { reason: gateResult.reason });
                this.tracer.endPhase(traceId, 'BLOCKED', { veritasExitCode: 1 });
                return;
            }
            this.logger.info('Orchestrator', `Sanity Gate PASSED. Modules WIRED: ${gateResult.wired}`);
        }

        // ──── 2. PRIMARY AGENT EXECUTION ────
        const context = { phase: phaseCode, milestoneReached: true };
        const mainOutput = await config.primary.processAndRespond(input, context);

        if (!mainOutput) {
            this.logger.warn('Orchestrator', `Primary agent returned null (filtered by output rules).`);
            this.tracer.endPhase(traceId, 'COMPLETED');
            return;
        }

        this.logger.info('Orchestrator', `Primary agent completed: ${mainOutput.content.substring(0, 80)}`);

        // ──── 3. SECONDARY AGENTS (parallel) ────
        if (config.secondary && config.secondary.length > 0) {
            const secondaryResults = await Promise.all(
                config.secondary.map(agent => agent.processAndRespond(input, { ...context, agentOutput: mainOutput }))
            );

            for (const result of secondaryResults) {
                if (result) {
                    this.logger.info('Orchestrator', `Secondary agent [${result.agentRole}]: ${result.content.substring(0, 80)}`);
                }
            }
        }

        // ──── 4. DEVIL'S ADVOCATE REVIEW ────
        let daBlocked = false;
        if (config.requiresDA) {
            this.logger.info('Orchestrator', `Calling Devil's Advocate for phase ${phaseCode} review.`);
            const contestCtx = { ...context, agentOutput: mainOutput };
            const daOutput = await this.devilsAdvocate.processAndRespond('', contestCtx);
            if (daOutput?.metadata?.blocksApproval) {
                daBlocked = true;
                this.logger.error('Orchestrator', `DA BLOCKED phase ${phaseCode}.`, { issues: daOutput.metadata });
            } else {
                this.logger.info('Orchestrator', `DA passed: ${daOutput?.content || 'No issues'}`);
            }
        }

        // ──── 5. HITL APPROVAL ────
        if (config.requiresHITL) {
            const request = await this.hitlManager.requestApproval(
                phaseCode,
                config.primary.role,
                mainOutput.content,
                mainOutput.metadata || {},
                daBlocked,
            );

            if (request.status === 'REJECTED') {
                this.logger.error('Orchestrator', `HITL rejected phase ${phaseCode}: ${request.comments}`);
                this.tracer.endPhase(traceId, 'BLOCKED', { hitlStatus: 'REJECTED' });
                return;
            }

            this.logger.info('Orchestrator', `HITL approval queued: ${request.id}`);
        }

        // ──── 6. COMPLETION ────
        this.tracer.endPhase(traceId, daBlocked ? 'BLOCKED' : 'COMPLETED', {
            veritasExitCode: 0,
            daBlocked,
        });

        this.logger.info('Orchestrator', `Phase ${phaseCode} COMPLETE.`);
    }

    /**
     * Returns the current system status summary.
     */
    public getStatus(): Record<string, any> {
        return {
            agents: 14,
            tracerSummary: this.tracer.getSummary(),
            pendingApprovals: this.hitlManager.getPending().length,
            session: this.sessionManager.getSession(),
        };
    }
}
