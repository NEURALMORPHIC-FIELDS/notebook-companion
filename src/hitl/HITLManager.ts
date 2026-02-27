/**
 * HITLManager.ts — Human-In-The-Loop approval gate controller
 * NEXUS AI v6 — HITL (§9 ARCHITECTURE.md)
 *
 * ARCHITECTURE.md §9:
 *   Agents never make irreversible-impact decisions without human approval.
 *   HITL controls granularity. Sanity Gate + Veritas run mandatorily before
 *   any HITL checkpoint — regardless of autonomy level.
 *
 * FIX: SanityGate is no longer instantiated internally.
 * The Orchestrator runs SanityGate once and passes GateResult here,
 * eliminating the double file-read from the previous implementation.
 */

import { ApprovalRequest, ApprovalStatus, createApprovalRequest } from './ApprovalRequest';
import type { GateResult } from '../veritas/SanityGate';

export class HITLManager {
    private pendingRequests: Map<string, ApprovalRequest> = new Map();
    private history: ApprovalRequest[] = [];
    private listeners: Array<(request: ApprovalRequest) => void> = [];

    /**
     * Creates an approval request.
     * Accepts a pre-computed GateResult from the Orchestrator (SanityGate runs once,
     * not twice). Auto-rejects if gate is blocked or Devil's Advocate found CRITICAL issues.
     *
     * @param phase        Current SDLC phase code
     * @param agentRole    Role of the primary agent for this phase
     * @param summary      Agent output summary shown to user
     * @param details      Full metadata
     * @param daBlocked    true if Devil's Advocate found CRITICAL issues
     * @param gateResult   Pre-computed result from SanityGate (passed from Orchestrator)
     */
    public async requestApproval(
        phase: string,
        agentRole: string,
        summary: string,
        details: Record<string, unknown>,
        daBlocked = false,
        gateResult: GateResult = { blocked: false },
    ): Promise<ApprovalRequest> {
        const veritasExitCode = gateResult.blocked ? 1 : 0;
        const request = createApprovalRequest(phase, agentRole, summary, details, veritasExitCode, daBlocked);

        // Auto-reject: Sanity Gate blocked
        if (gateResult.blocked) {
            request.status = 'REJECTED' as ApprovalStatus;
            request.resolvedAt = new Date().toISOString();
            request.resolvedBy = 'auto';
            request.comments = `Auto-rejected — Sanity Gate blocked: ${gateResult.reason}`;
            this.history.push(request);
            console.error(`[HITL] Auto-rejected (Sanity Gate): ${gateResult.reason}`);
            return request;
        }

        // Auto-reject: Devil's Advocate found CRITICAL issues
        if (daBlocked) {
            request.status = 'REJECTED' as ApprovalStatus;
            request.resolvedAt = new Date().toISOString();
            request.resolvedBy = 'auto';
            request.comments = "Auto-rejected — Devil's Advocate found CRITICAL issues. Agent must remediate before continuing.";
            this.history.push(request);
            console.error("[HITL] Auto-rejected (Devil's Advocate CRITICAL block).");
            return request;
        }

        // Queue for human approval
        this.pendingRequests.set(request.id, request);
        console.info(`[HITL] Approval request queued: ${request.id} for Phase ${phase}`);
        this.notifyListeners(request);
        return request;
    }

    /**
     * Resolve a pending approval (human decision).
     * Returns false if request ID not found.
     */
    public resolve(requestId: string, status: 'APPROVED' | 'REJECTED', comments?: string): boolean {
        const request = this.pendingRequests.get(requestId);
        if (!request) {
            console.error(`[HITL] Request ${requestId} not found in pending queue.`);
            return false;
        }

        request.status = status as ApprovalStatus;
        request.resolvedAt = new Date().toISOString();
        request.resolvedBy = 'user';
        request.comments = comments;

        this.pendingRequests.delete(requestId);
        this.history.push(request);
        console.info(`[HITL] Request ${requestId} resolved: ${status}`);
        return true;
    }

    /**
     * Update summary text for a pending request (used by HITL "Modify" flow).
     * Returns false if request ID is missing from pending queue.
     */
    public updateSummary(requestId: string, summary: string): boolean {
        const request = this.pendingRequests.get(requestId);
        if (!request) {
            console.error(`[HITL] Request ${requestId} not found for summary update.`);
            return false;
        }
        request.summary = summary;
        return true;
    }

    public getPending(): ApprovalRequest[] {
        return Array.from(this.pendingRequests.values());
    }

    public getHistory(): ApprovalRequest[] {
        return [...this.history];
    }

    public onRequest(listener: (request: ApprovalRequest) => void): void {
        this.listeners.push(listener);
    }

    private notifyListeners(request: ApprovalRequest): void {
        this.listeners.forEach(fn => fn(request));
    }
}
