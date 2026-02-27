/**
 * OrchestratorStore — Reactive bridge between orchestrator classes and React UI.
 * Singleton that maintains live state of phases, agents, approvals, and notebook.
 *
 * PIPELINE FIX: PhaseSequencer is now wired here.
 * When user approves Phase N → resolveApproval → phaseSequencer.onApproved(N)
 * → PhaseSequencer auto-builds input for Phase N+1 → runPhaseWithLLM(N+1)
 * This closes the missing horizontal pipeline gap.
 */

import { PhaseTracer, PhaseMetrics } from '@/observability/PhaseTracer';
import { HITLManager } from '@/hitl/HITLManager';
import { ApprovalRequest } from '@/hitl/ApprovalRequest';
import { callAgentLLM } from '@/services/AgentLLMService';
import { PhaseSequencer } from '@/orchestrator/PhaseSequencer';
import { pmCreateRepo, pmCommitFile, phaseToFilePath, extractProjectName } from '@/services/GitHubService';
import { loadRepoConfig } from '@/services/FileWriterService';
import {
  globalArchitectureVigilance,
  type GlobalVigilanceState,
  type VigilanceResult,
} from '@/services/GlobalArchitectureVigilance';

export type PhaseStatus = 'completed' | 'in-progress' | 'pending' | 'blocked';
export type AgentStatus = 'active' | 'idle' | 'working' | 'blocked';
export type AutonomyMode = 1 | 2 | 3 | 4 | 5;

export interface AutonomyModeOption {
  mode: AutonomyMode;
  title: string;
  description: string;
}

export const AUTONOMY_MODE_OPTIONS: ReadonlyArray<AutonomyModeOption> = [
  {
    mode: 1,
    title: 'Mode 1 · Strict per implementation',
    description: 'Approval is requested for each implementation unit (function-level for coding phases).',
  },
  {
    mode: 2,
    title: 'Mode 2 · One approval per agent',
    description: 'Each agent needs one approval once. Future outputs from the same agent auto-pass.',
  },
  {
    mode: 3,
    title: 'Mode 3 · Systemic changes only',
    description: 'Approval is required only when global architecture vigilance detects systemic impact.',
  },
  {
    mode: 4,
    title: 'Mode 4 · Design only',
    description: 'Approval is required only for design-oriented outputs (brand/UI/visual).',
  },
  {
    mode: 5,
    title: 'Mode 5 · Full autonomy',
    description: 'No HITL approvals. Orchestrator runs end-to-end and GitHub auto-commit is disabled.',
  },
];

export interface LivePhase {
  id: string;
  number: string;
  name: string;
  agent: string;
  status: PhaseStatus;
  output?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface LiveAgent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  icon: string;
  color: string;
  lastActivity?: string;
  currentPhase?: string;
}

export interface OrchestratorState {
  phases: LivePhase[];
  agents: LiveAgent[];
  pendingApprovals: ApprovalRequest[];
  approvalHistory: ApprovalRequest[];
  completedTraces: PhaseMetrics[];
  activeTraces: PhaseMetrics[];
  currentPhase: string | null;
  veritasExitCode: number;
  notebookEntries: NotebookCodeEntry[];
  globalVigilance: GlobalVigilanceState;
  autonomyMode: AutonomyMode;
  approvedAgentRoles: string[];
}

export interface NotebookCodeEntry {
  sourceAgent: string;
  phase: string;
  code: string;
  language: string;
  description: string;
}

interface ApprovalUnit {
  approvalKey: string;
  summary: string;
}

interface AutonomyPolicyDecision {
  shouldRequestApproval: boolean;
  reason: string;
  approvalUnits: ApprovalUnit[];
}

interface RequestApprovalOptions {
  autoApprove?: boolean;
  autoComment?: string;
}

type Listener = (state: OrchestratorState) => void;

const INITIAL_PHASES: LivePhase[] = [
  { id: '0', number: '0', name: 'Onboarding', agent: 'System', status: 'completed', output: 'Template + HITL + verify_project.py' },
  { id: '1a', number: '1A', name: 'Functional Architecture Sheet', agent: 'PM', status: 'pending' },
  { id: '1b', number: '1B', name: 'Discovery & PRD', agent: 'PM', status: 'pending' },
  { id: '2', number: '2', name: 'Team Assembly', agent: 'PM', status: 'pending' },
  { id: '3a', number: '3A', name: 'Architecture', agent: "Architect + Devil's Advocate", status: 'pending' },
  { id: '3b', number: '3B', name: 'Brand & Design System', agent: 'Brand + UI/UX', status: 'pending' },
  { id: '4', number: '4', name: 'Technical Design', agent: "Tech Lead + Devil's Advocate", status: 'pending' },
  { id: '5', number: '5', name: 'Task Breakdown', agent: 'PM', status: 'pending' },
  { id: '6a', number: '6A', name: 'Implementation — Dev', agent: 'Engineers', status: 'pending' },
  { id: '6b', number: '6B', name: 'Implementation — Assets', agent: 'Asset Generator', status: 'pending' },
  { id: '7', number: '7', name: 'Code Review', agent: 'Code Reviewer', status: 'pending' },
  { id: '8', number: '8', name: 'QA & Testing', agent: 'QA Engineer', status: 'pending' },
  { id: '9', number: '9', name: 'Security Audit', agent: 'Security Auditor', status: 'pending' },
  { id: '10', number: '10', name: 'Documentation', agent: 'Tech Writer', status: 'pending' },
  { id: '11', number: '11', name: 'DevOps / Deploy', agent: 'DevOps Engineer', status: 'pending' },
];

const INITIAL_AGENTS: LiveAgent[] = [
  { id: 'pm', name: 'Project Manager', role: 'Orchestration & FAS', status: 'idle', icon: 'kanban', color: 'nexus-cyan' },
  { id: 'architect', name: 'Architect', role: 'ADR & System Design', status: 'idle', icon: 'blocks', color: 'nexus-purple' },
  { id: 'devils-advocate', name: "Devil's Advocate", role: 'Contestation', status: 'idle', icon: 'flame', color: 'nexus-red' },
  { id: 'tech-lead', name: 'Tech Lead', role: 'Tech Spec', status: 'idle', icon: 'cpu', color: 'nexus-blue' },
  { id: 'backend', name: 'Backend Engineer', role: 'Server & API', status: 'idle', icon: 'server', color: 'nexus-green' },
  { id: 'frontend', name: 'Frontend Engineer', role: 'UI & Components', status: 'idle', icon: 'monitor', color: 'nexus-cyan' },
  { id: 'qa', name: 'QA Engineer', role: 'Testing', status: 'idle', icon: 'flask-conical', color: 'nexus-amber' },
  { id: 'security', name: 'Security Auditor', role: 'OWASP', status: 'idle', icon: 'shield-check', color: 'nexus-red' },
  { id: 'code-reviewer', name: 'Code Reviewer', role: 'Review', status: 'idle', icon: 'scan-eye', color: 'nexus-purple' },
  { id: 'tech-writer', name: 'Tech Writer', role: 'Documentation', status: 'idle', icon: 'book-open', color: 'nexus-blue' },
  { id: 'devops', name: 'DevOps Engineer', role: 'CI/CD', status: 'idle', icon: 'rocket', color: 'nexus-amber' },
  { id: 'brand', name: 'Brand Designer', role: 'Visual Identity', status: 'idle', icon: 'gem', color: 'nexus-purple' },
  { id: 'uiux', name: 'UI/UX Designer', role: 'Design System', status: 'idle', icon: 'pen-tool', color: 'nexus-cyan' },
  { id: 'asset-gen', name: 'Asset Generator', role: 'Images & Icons', status: 'idle', icon: 'image', color: 'nexus-green' },
];

const STORAGE_KEY = 'nexus-orchestrator-state';

class OrchestratorStoreImpl {
  private state: OrchestratorState;
  private listeners: Set<Listener> = new Set();
  private hitlManager = new HITLManager();
  private tracer = PhaseTracer.getInstance();
  /** Phases currently running — prevents same phase starting twice (race condition guard) */
  private activePhases = new Set<string>();

  /**
   * PhaseSequencer instance — auto-advances phases after HITL approval.
   * Callbacks are bound to this store's methods so sequencer can
   * start phases and update UI state.
   */
  private sequencer = new PhaseSequencer(
    async (phase: string, input: string) => {
      await this.runPhaseWithLLM(phase, input);
    },
    (phase: string, reason: string) => {
      this.blockPhase(phase, reason);
    }
  );

  constructor() {
    const saved = this.loadState();
    const vigilanceState = globalArchitectureVigilance.getState();
    this.state = saved
      ? {
        ...saved,
        globalVigilance: saved.globalVigilance ?? vigilanceState,
        autonomyMode: saved.autonomyMode ?? 2,
        approvedAgentRoles: saved.approvedAgentRoles ?? [],
      }
      : {
        phases: [...INITIAL_PHASES],
        agents: [...INITIAL_AGENTS],
        pendingApprovals: [],
        approvalHistory: [],
        completedTraces: [],
        activeTraces: [],
        currentPhase: null,
        veritasExitCode: -1,
        notebookEntries: [],
        globalVigilance: vigilanceState,
        autonomyMode: 2,
        approvedAgentRoles: [],
      };

    // Wire HITL manager to emit events
    this.hitlManager.onRequest((req) => {
      this.state.pendingApprovals = this.hitlManager.getPending();
      this.notify();
    });
  }

  private loadState(): OrchestratorState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // ignore localStorage persistence errors at runtime
    }
  }

  private notify() {
    this.persist();
    this.listeners.forEach(fn => fn(this.state));
    window.dispatchEvent(new CustomEvent('nexus-orchestrator-update', { detail: this.state }));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): OrchestratorState {
    return this.state;
  }

  setAutonomyMode(mode: AutonomyMode) {
    if (this.state.autonomyMode === mode) {
      return;
    }
    this.state.autonomyMode = mode;
    if (mode !== 2) {
      this.state.approvedAgentRoles = [];
    }
    this.notify();

    if (mode === 5 && this.state.pendingApprovals.length > 0) {
      const pendingIds = this.state.pendingApprovals.map(req => req.id);
      pendingIds.forEach((requestId) => {
        this.resolveApproval(
          requestId,
          'APPROVED',
          'Auto-approved because autonomy mode was switched to full autonomy.',
        );
      });
    }
  }

  private buildApprovalUnits(phaseNumber: string, summary: string): ApprovalUnit[] {
    const fallback: ApprovalUnit = { approvalKey: 'phase-default', summary };
    if (this.state.autonomyMode !== 1 || (phaseNumber !== '6A' && phaseNumber !== '6B')) {
      return [fallback];
    }

    const lines = summary.split('\n');
    const units: ApprovalUnit[] = [];
    const functionRegex =
      /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(|^\s*(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const match = line.match(functionRegex);
      const functionName = match?.[1] ?? match?.[2];
      if (!functionName) {
        continue;
      }

      const snippet = lines.slice(lineIndex, Math.min(lineIndex + 20, lines.length)).join('\n');
      units.push({
        approvalKey: `function-${functionName}-${lineIndex}`,
        summary: `Function ${functionName}\n\n${snippet}`,
      });

      if (units.length >= 24) {
        break;
      }
    }

    return units.length > 0 ? units : [fallback];
  }

  private evaluateAutonomyPolicy(
    phaseNumber: string,
    agentRole: string,
    summary: string,
    vigilance: VigilanceResult,
  ): AutonomyPolicyDecision {
    const mode = this.state.autonomyMode;
    const phaseAlerts = globalArchitectureVigilance.getPhaseAlerts(phaseNumber);
    const hasSystemicChange =
      vigilance.changed ||
      this.state.globalVigilance.stalePhases.length > 0 ||
      phaseAlerts.some(alert => alert.type === 'UPSTREAM_CHANGED' || alert.severity === 'HIGH');
    const isDesignOutput =
      phaseNumber === '3B' ||
      phaseNumber === '6B' ||
      /\b(design|logo|color|palette|typography|font|visual|ui|ux)\b/i.test(summary);

    if (mode === 1) {
      return {
        shouldRequestApproval: true,
        reason: 'Mode 1 requires approval for each implementation unit.',
        approvalUnits: this.buildApprovalUnits(phaseNumber, summary),
      };
    }

    if (mode === 2) {
      const alreadyApproved = this.state.approvedAgentRoles.includes(agentRole);
      return {
        shouldRequestApproval: !alreadyApproved,
        reason: alreadyApproved
          ? `Mode 2: ${agentRole} already approved once, auto-pass active.`
          : `Mode 2: waiting first approval for ${agentRole}.`,
        approvalUnits: [{ approvalKey: 'agent-once', summary }],
      };
    }

    if (mode === 3) {
      return {
        shouldRequestApproval: hasSystemicChange,
        reason: hasSystemicChange
          ? 'Mode 3: systemic architecture change detected by vigilance.'
          : 'Mode 3: no systemic architecture impact detected.',
        approvalUnits: [{ approvalKey: 'systemic-change', summary }],
      };
    }

    if (mode === 4) {
      return {
        shouldRequestApproval: isDesignOutput,
        reason: isDesignOutput
          ? 'Mode 4: design output requires approval.'
          : 'Mode 4: non-design output auto-approved.',
        approvalUnits: [{ approvalKey: 'design-only', summary }],
      };
    }

    return {
      shouldRequestApproval: false,
      reason: 'Mode 5: full autonomy without HITL approvals.',
      approvalUnits: [{ approvalKey: 'full-autonomy', summary }],
    };
  }

  private resolveRemainingPhaseRequests(phase: string, comment: string) {
    const siblings = this.state.pendingApprovals.filter(req => req.phase === phase);
    siblings.forEach((req) => {
      this.hitlManager.resolve(req.id, 'REJECTED', comment);
    });
    this.state.pendingApprovals = this.hitlManager.getPending();
    this.state.approvalHistory = this.hitlManager.getHistory();
  }

  private extractPipelineOutput(request: ApprovalRequest): string {
    const details = request.details as Record<string, unknown> | undefined;
    const pipelineOutput = details?.pipelineOutput;
    if (typeof pipelineOutput === 'string' && pipelineOutput.length > 0) {
      return pipelineOutput;
    }
    return request.summary ?? '';
  }

  // ─── Phase Management ────────────────────────────
  startPhase(phaseNumber: string, agentId?: string) {
    this.state.phases = this.state.phases.map(p =>
      p.number === phaseNumber ? { ...p, status: 'in-progress' as const, startedAt: new Date().toISOString() } : p
    );
    this.state.currentPhase = phaseNumber;
    if (agentId) {
      this.setAgentStatus(agentId, 'working', phaseNumber);
    }
    this.notify();
  }

  completePhase(phaseNumber: string, output?: string) {
    this.state.phases = this.state.phases.map(p =>
      p.number === phaseNumber
        ? { ...p, status: 'completed' as const, output, completedAt: new Date().toISOString() }
        : p
    );
    this.state.currentPhase = null;
    // Reset agents working on this phase
    this.state.agents = this.state.agents.map(a =>
      a.currentPhase === phaseNumber ? { ...a, status: 'idle' as const, currentPhase: undefined } : a
    );
    // Record full output in PhaseSequencer for use as input to next phase
    if (output) {
      this.sequencer.recordPhaseOutput(phaseNumber, output);
    }
    this.notify();
  }

  blockPhase(phaseNumber: string, reason?: string) {
    this.state.phases = this.state.phases.map(p =>
      p.number === phaseNumber ? { ...p, status: 'blocked' as const, output: reason } : p
    );
    this.notify();
  }

  // ─── Agent Management ────────────────────────────
  setAgentStatus(agentId: string, status: AgentStatus, currentPhase?: string) {
    this.state.agents = this.state.agents.map(a =>
      a.id === agentId
        ? { ...a, status, currentPhase, lastActivity: new Date().toISOString() }
        : a
    );
    this.notify();
  }

  // ─── HITL Management ─────────────────────────────
  async requestApproval(
    phase: string,
    agentRole: string,
    summary: string,
    details: Record<string, unknown>,
    daBlocked = false,
    options?: RequestApprovalOptions,
  ) {
    const approvalKey = String(details.approvalKey ?? 'phase-default');

    if (this.state.autonomyMode === 5 && !options?.autoApprove) {
      return this.requestApproval(
        phase,
        agentRole,
        summary,
        details,
        daBlocked,
        {
          autoApprove: true,
          autoComment: 'Mode 5 is active. HITL request auto-approved.',
        },
      );
    }

    if (options?.autoApprove) {
      const now = new Date().toISOString();
      const autoRequest: ApprovalRequest = {
        id: `auto-${phase}-${approvalKey}-${Date.now()}`,
        phase,
        agentRole,
        summary,
        details: {
          ...details,
          autoApproved: true,
          autonomyMode: this.state.autonomyMode,
        },
        veritasExitCode: 0,
        blockedByDA: daBlocked,
        status: 'APPROVED',
        createdAt: now,
        resolvedAt: now,
        resolvedBy: 'auto',
        comments: options.autoComment ?? `Auto-approved by autonomy policy (mode ${this.state.autonomyMode}).`,
      };
      this.state.approvalHistory = [...this.state.approvalHistory, autoRequest];
      this.notify();
      return autoRequest;
    }

    const alreadyPending = this.state.pendingApprovals.some((req) => {
      const existingKey = String((req.details as Record<string, unknown>)?.approvalKey ?? 'phase-default');
      return req.phase === phase && existingKey === approvalKey;
    });
    if (alreadyPending) {
      console.warn(`[HITL] Skipped duplicate approval request for Phase ${phase} (${approvalKey}) — already pending.`);
      return this.state.pendingApprovals.find((req) => {
        const existingKey = String((req.details as Record<string, unknown>)?.approvalKey ?? 'phase-default');
        return req.phase === phase && existingKey === approvalKey;
      })!;
    }

    const request = await this.hitlManager.requestApproval(phase, agentRole, summary, details, daBlocked);
    this.state.pendingApprovals = this.hitlManager.getPending();
    this.state.approvalHistory = this.hitlManager.getHistory();
    this.notify();
    return request;
  }

  /**
   * Resolve a pending HITL approval.
   *
   * PIPELINE CONNECTION:
   * When status = 'APPROVED', PhaseSequencer.onApproved() is called.
   * It builds the context-aware input for the next phase and auto-starts it.
   * This replaces the previous dead-end where approval only updated the UI.
   */
  resolveApproval(requestId: string, status: 'APPROVED' | 'REJECTED', comments?: string) {
    // Find the request before resolving (we need phase + summary for sequencer)
    const pending = this.state.pendingApprovals.find(r => r.id === requestId);

    if (
      status === 'APPROVED' &&
      pending &&
      globalArchitectureVigilance.isPhaseStale(pending.phase)
    ) {
      const staleReason = `[GLOBAL_VIGILANCE] Phase ${pending.phase} is stale due to upstream changes. Regenerate phase before approval.`;
      this.hitlManager.resolve(requestId, 'REJECTED', staleReason);
      this.state.pendingApprovals = this.hitlManager.getPending();
      this.state.approvalHistory = this.hitlManager.getHistory();
      this.state.globalVigilance = globalArchitectureVigilance.getState();
      this.blockPhase(pending.phase, staleReason);
      this.notify();
      return;
    }

    this.hitlManager.resolve(requestId, status, comments);
    this.state.pendingApprovals = this.hitlManager.getPending();
    this.state.approvalHistory = this.hitlManager.getHistory();
    if (!pending) {
      this.notify();
      return;
    }

    if (status === 'REJECTED') {
      this.resolveRemainingPhaseRequests(
        pending.phase,
        comments ?? `Auto-rejected because another approval unit in Phase ${pending.phase} was rejected.`,
      );
      this.blockPhase(pending.phase, comments ?? 'Rejected by user.');
      this.notify();
      return;
    }

    if (this.state.autonomyMode === 2 && !this.state.approvedAgentRoles.includes(pending.agentRole)) {
      this.state.approvedAgentRoles = [...this.state.approvedAgentRoles, pending.agentRole];
    }

    const samePhasePending = this.state.pendingApprovals.some(req => req.phase === pending.phase);
    this.notify();
    if (samePhasePending) {
      return;
    }

    const phaseOutput = this.extractPipelineOutput(pending);
    this.sequencer.onApproved(pending.phase, phaseOutput).catch(err => {
      console.error('[OrchestratorStore] PhaseSequencer error:', err);
    });
  }

  updateApprovalSummary(requestId: string, summary: string): boolean {
    const updated = this.hitlManager.updateSummary(requestId, summary);
    if (!updated) {
      return false;
    }
    this.state.pendingApprovals = this.hitlManager.getPending();
    this.state.approvalHistory = this.hitlManager.getHistory();
    this.notify();
    return true;
  }

  // ─── Notebook ────────────────────────────────────
  submitToNotebook(entry: NotebookCodeEntry) {
    this.state.notebookEntries.push(entry);
    // Also dispatch to the notebook panel
    window.dispatchEvent(new CustomEvent('nexus-notebook-submit', { detail: entry }));
    this.notify();
  }

  // ─── Veritas ─────────────────────────────────────
  setVeritasExitCode(code: number) {
    this.state.veritasExitCode = code;
    this.notify();
  }

  // ─── Run a full phase with real LLM ──────────────
  async runPhaseWithLLM(phaseNumber: string, input: string): Promise<string | null> {
    // PARALLEL GUARD: if this phase is already running, skip
    if (this.activePhases.has(phaseNumber)) {
      console.warn(`[OrchestratorStore] Phase ${phaseNumber} already running — skipped duplicate trigger.`);
      return null;
    }
    this.activePhases.add(phaseNumber);

    const phaseToAgent: Record<string, { agentId: string; agentRole: string }> = {
      '1A': { agentId: 'pm', agentRole: 'project-manager' },
      '1B': { agentId: 'pm', agentRole: 'project-manager' },
      '2': { agentId: 'pm', agentRole: 'project-manager' },
      '3A': { agentId: 'architect', agentRole: 'architect' },
      '3B': { agentId: 'brand', agentRole: 'brand-designer' },
      '4': { agentId: 'tech-lead', agentRole: 'tech-lead' },
      '5': { agentId: 'pm', agentRole: 'project-manager' },
      '6A': { agentId: 'backend', agentRole: 'backend-engineer' },
      '6B': { agentId: 'asset-gen', agentRole: 'asset-generator' },
      '7': { agentId: 'code-reviewer', agentRole: 'code-reviewer' },
      '8': { agentId: 'qa', agentRole: 'qa-engineer' },
      '9': { agentId: 'security', agentRole: 'security-auditor' },
      '10': { agentId: 'tech-writer', agentRole: 'tech-writer' },
      '11': { agentId: 'devops', agentRole: 'devops-engineer' },
    };

    const mapping = phaseToAgent[phaseNumber];
    if (!mapping) {
      this.activePhases.delete(phaseNumber);
      return null;
    }

    this.startPhase(phaseNumber, mapping.agentId);

    try {
      const response = await callAgentLLM({
        agentRole: mapping.agentRole,
        messages: [{ role: 'user', content: input }],
        phase: phaseNumber,
      });

      const vigilance = globalArchitectureVigilance.recordPhaseOutput(
        phaseNumber,
        mapping.agentRole,
        response,
      );
      this.state.globalVigilance = vigilance.state;
      this.notify();

      if (vigilance.blocked) {
        const reason = vigilance.alerts
          .filter(a => a.severity === 'HIGH')
          .map(a => a.message)
          .join(' | ');
        this.blockPhase(phaseNumber, `[GLOBAL_VIGILANCE] ${reason}`);
        this.setAgentStatus(mapping.agentId, 'blocked');
        return null;
      }

      // Store FULL response in sequencer (not truncated) for downstream phases
      this.sequencer.recordPhaseOutput(phaseNumber, response);

      // Update phase status with preview (first 200 chars)
      this.completePhase(phaseNumber, response.substring(0, 200));

      // ALL phases: submit output to Notebook panel for review and GitHub commit
      // overallStatus='passed' so RepoPanel shows it immediately as eligible
      this.submitToNotebook({
        sourceAgent: mapping.agentRole,
        phase: phaseNumber,
        code: response,
        language: phaseNumber === '6A' || phaseNumber === '6B' ? 'typescript' : 'markdown',
        description: `Phase ${phaseNumber} output — ${mapping.agentRole}`,
      });

      // ── PM GITHUB OPERATIONS ────────────────────────────────────────────────
      // PM is the sole committer; all phase outputs can be persisted to GitHub.
      if (this.state.autonomyMode === 5) {
        console.info(`[PM] GitHub auto-commit blocked by autonomy mode 5 for Phase ${phaseNumber}.`);
      } else {
        const ghConfig = loadRepoConfig();
        if (ghConfig?.token) {
          let repoReady = Boolean(ghConfig.owner && ghConfig.repo);

          // Phase 1A may start before a repository exists — create it first.
          if (mapping.agentRole === 'project-manager' && phaseNumber === '1A' && !repoReady) {
            const projectName = extractProjectName(response);
            const desc = `NEXUS AI v6 generated project: ${projectName}`;
            try {
              const repo = await pmCreateRepo(projectName, desc, false);
              repoReady = true;
              console.info(`[PM] Created GitHub repo: ${repo.html_url}`);
              window.dispatchEvent(new CustomEvent('nexus-pm-repo-created', { detail: repo }));
            } catch (err) {
              const e = err as { status?: number; message?: string };
              if (e.status === 422) {
                console.warn('[PM] Repo name conflict — repository may already exist. Commit will use current repo config.');
              } else {
                console.error('[PM] Failed to create repo:', e.message);
              }
            }
          }

          if (!repoReady) {
            const refreshedConfig = loadRepoConfig();
            repoReady = Boolean(refreshedConfig?.owner && refreshedConfig?.repo);
          }

          if (repoReady) {
            const filePath = phaseToFilePath(phaseNumber, mapping.agentRole);
            const pathCheck = globalArchitectureVigilance.validatePhaseFilePath(phaseNumber, filePath);
            this.state.globalVigilance = pathCheck.state;
            this.notify();
            if (!pathCheck.allowed) {
              const pathReason = pathCheck.alert?.message ?? `Invalid phase path mapping for ${phaseNumber}`;
              console.warn(`[PM] Commit blocked by global vigilance: ${pathReason}`);
              this.blockPhase(phaseNumber, `[GLOBAL_VIGILANCE] ${pathReason}`);
              this.setAgentStatus(mapping.agentId, 'blocked');
              return null;
            }
            const commitMsg = mapping.agentRole === 'project-manager'
              ? `[PM • NEXUS AI] Phase ${phaseNumber}: ${mapping.agentRole} output`
              : `[PM • NEXUS AI] Phase ${phaseNumber} (${mapping.agentRole}) — committed by PM`;
            pmCommitFile(filePath, response, commitMsg)
              .then(result => {
                console.info(`[PM] Committed Phase ${phaseNumber}: ${result.html_url}`);
              })
              .catch(err => {
                const e = err as { message?: string };
                console.warn(`[PM] Commit skipped for Phase ${phaseNumber}: ${e.message}`);
              });
          } else {
            console.info(`[PM] Repository not configured yet — skipping auto-commit for Phase ${phaseNumber}.`);
          }
        } else {
          console.info('[PM] No GitHub token configured — skipping auto-commit. Connect GitHub in the Repo panel.');
        }
      }
      // ─────────────────────────────────────────────────────────────────

      const phaseAlerts = globalArchitectureVigilance.getPhaseAlerts(phaseNumber);
      const policy = this.evaluateAutonomyPolicy(phaseNumber, mapping.agentRole, response, vigilance);

      if (policy.shouldRequestApproval) {
        for (const unit of policy.approvalUnits) {
          await this.requestApproval(
            phaseNumber,
            mapping.agentRole,
            unit.summary,
            {
              phase: phaseNumber,
              agentRole: mapping.agentRole,
              approvalKey: unit.approvalKey,
              approvalReason: policy.reason,
              approvalUnitCount: policy.approvalUnits.length,
              pipelineOutput: response,
              globalVigilance: this.state.globalVigilance,
              phaseAlerts,
            },
          );
        }
      } else {
        await this.requestApproval(
          phaseNumber,
          mapping.agentRole,
          response,
          {
            phase: phaseNumber,
            agentRole: mapping.agentRole,
            approvalKey: 'auto-pass',
            approvalReason: policy.reason,
            pipelineOutput: response,
            globalVigilance: this.state.globalVigilance,
            phaseAlerts,
          },
          false,
          {
            autoApprove: true,
            autoComment: policy.reason,
          },
        );

        this.sequencer.onApproved(phaseNumber, response).catch(err => {
          console.error('[OrchestratorStore] PhaseSequencer error:', err);
        });
      }

      return response;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Error';
      this.blockPhase(phaseNumber, reason);
      this.setAgentStatus(mapping.agentId, 'blocked');
      return null;
    } finally {
      // Always release the phase lock, even on error
      this.activePhases.delete(phaseNumber);
    }
  }

  // ─── Reset ───────────────────────────────────────
  reset() {
    this.sequencer.reset();
    globalArchitectureVigilance.clear();
    this.state = {
      phases: [...INITIAL_PHASES],
      agents: [...INITIAL_AGENTS],
      pendingApprovals: [],
      approvalHistory: [],
      completedTraces: [],
      activeTraces: [],
      currentPhase: null,
      veritasExitCode: -1,
      notebookEntries: [],
      globalVigilance: globalArchitectureVigilance.getState(),
      autonomyMode: 2,
      approvedAgentRoles: [],
    };
    this.notify();
  }
}

// Singleton
export const orchestratorStore = new OrchestratorStoreImpl();
