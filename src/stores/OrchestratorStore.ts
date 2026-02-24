/**
 * OrchestratorStore — Reactive bridge between orchestrator classes and React UI.
 * Singleton that maintains live state of phases, agents, approvals, and notebook.
 */

import { PhaseTracer, PhaseMetrics } from '@/observability/PhaseTracer';
import { HITLManager } from '@/hitl/HITLManager';
import { ApprovalRequest } from '@/hitl/ApprovalRequest';
import { callAgentLLM } from '@/services/AgentLLMService';

export type PhaseStatus = 'completed' | 'in-progress' | 'pending' | 'blocked';
export type AgentStatus = 'active' | 'idle' | 'working' | 'blocked';

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
}

export interface NotebookCodeEntry {
  sourceAgent: string;
  phase: string;
  code: string;
  language: string;
  description: string;
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

  constructor() {
    const saved = this.loadState();
    this.state = saved || {
      phases: [...INITIAL_PHASES],
      agents: [...INITIAL_AGENTS],
      pendingApprovals: [],
      approvalHistory: [],
      completedTraces: [],
      activeTraces: [],
      currentPhase: null,
      veritasExitCode: -1,
      notebookEntries: [],
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
    } catch { }
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
  async requestApproval(phase: string, agentRole: string, summary: string, details: Record<string, any>, daBlocked = false) {
    const request = await this.hitlManager.requestApproval(phase, agentRole, summary, details, daBlocked);
    this.state.pendingApprovals = this.hitlManager.getPending();
    this.state.approvalHistory = this.hitlManager.getHistory();
    this.notify();
    return request;
  }

  resolveApproval(requestId: string, status: 'APPROVED' | 'REJECTED', comments?: string) {
    this.hitlManager.resolve(requestId, status, comments);
    this.state.pendingApprovals = this.hitlManager.getPending();
    this.state.approvalHistory = this.hitlManager.getHistory();
    this.notify();
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
    if (!mapping) return null;

    this.startPhase(phaseNumber, mapping.agentId);

    try {
      const response = await callAgentLLM({
        agentRole: mapping.agentRole,
        messages: [{ role: 'user', content: input }],
        phase: phaseNumber,
      });

      this.completePhase(phaseNumber, response.substring(0, 200));

      // If implementation phase, submit code to notebook
      if (['6A', '6B'].includes(phaseNumber) && response.includes('```')) {
        this.submitToNotebook({
          sourceAgent: mapping.agentRole,
          phase: phaseNumber,
          code: response,
          language: 'typescript',
          description: `Code from phase ${phaseNumber}`,
        });
      }

      return response;
    } catch (err) {
      this.blockPhase(phaseNumber, err instanceof Error ? err.message : 'Error');
      this.setAgentStatus(mapping.agentId, 'blocked');
      return null;
    }
  }

  // ─── Reset ───────────────────────────────────────
  reset() {
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
    };
    this.notify();
  }
}

// Singleton
export const orchestratorStore = new OrchestratorStoreImpl();
