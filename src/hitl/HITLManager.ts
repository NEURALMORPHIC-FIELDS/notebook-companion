// HITLManager.ts — Human-In-The-Loop approval gate controller
import { ApprovalRequest, ApprovalStatus, createApprovalRequest } from './ApprovalRequest';
import { SanityGate, GateResult } from '../veritas/SanityGate';

export class HITLManager {
    private pendingRequests: Map<string, ApprovalRequest> = new Map();
    private history: ApprovalRequest[] = [];
    private sanityGate = new SanityGate();
    private listeners: Array<(request: ApprovalRequest) => void> = [];

    /**
     * Creates an approval request after verifying Sanity Gate.
     * If Sanity Gate blocks, the HITL request is auto-rejected.
     */
    public async requestApproval(
        phase: string,
        agentRole: string,
        summary: string,
        details: Record<string, any>,
        daBlocked: boolean = false,
    ): Promise<ApprovalRequest> {
        // 1. Check Sanity Gate first
        const gateResult = await this.sanityGate.check(phase);
        const veritasExitCode = gateResult.blocked ? 1 : 0;

        // 2. Create the request
        const request = createApprovalRequest(phase, agentRole, summary, details, veritasExitCode, daBlocked);

        // 3. Auto-reject if Sanity Gate blocks
        if (gateResult.blocked) {
            request.status = 'REJECTED';
            request.resolvedAt = new Date().toISOString();
            request.resolvedBy = 'auto';
            request.comments = `Auto-rejected: ${gateResult.reason}`;
            this.history.push(request);
            console.error(`[HITL] Auto-rejected: ${gateResult.reason}`);
            return request;
        }

        // 4. Auto-reject if Devil's Advocate blocks
        if (daBlocked) {
            request.status = 'REJECTED';
            request.resolvedAt = new Date().toISOString();
            request.resolvedBy = 'auto';
            request.comments = "Auto-rejected: Devil's Advocate found CRITICAL issues.";
            this.history.push(request);
            console.error("[HITL] Auto-rejected: DA critical block.");
            return request;
        }

        // 5. Queue for human approval
        this.pendingRequests.set(request.id, request);
        console.log(`[HITL] Approval request queued: ${request.id} for phase ${phase}`);
        this.notifyListeners(request);
        return request;
    }

    /**
     * Resolves a pending approval request (approve or reject).
     */
    public resolve(requestId: string, status: 'APPROVED' | 'REJECTED', comments?: string): boolean {
        const request = this.pendingRequests.get(requestId);
        if (!request) {
            console.error(`[HITL] Request ${requestId} not found.`);
            return false;
        }

        request.status = status;
        request.resolvedAt = new Date().toISOString();
        request.resolvedBy = 'user';
        request.comments = comments;

        this.pendingRequests.delete(requestId);
        this.history.push(request);
        console.log(`[HITL] Request ${requestId} resolved: ${status}`);
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
