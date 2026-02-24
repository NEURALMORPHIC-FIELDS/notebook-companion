// ApprovalRequest.ts — typed model for HITL approval requests

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'TIMED_OUT';

export interface ApprovalRequest {
    id: string;
    phase: string;
    agentRole: string;
    summary: string;
    details: Record<string, any>;
    veritasExitCode: number;
    blockedByDA: boolean;
    status: ApprovalStatus;
    createdAt: string;
    resolvedAt?: string;
    resolvedBy?: 'user' | 'auto';
    comments?: string;
}

export function createApprovalRequest(
    phase: string,
    agentRole: string,
    summary: string,
    details: Record<string, any>,
    veritasExitCode: number,
    blockedByDA: boolean,
): ApprovalRequest {
    return {
        id: `hitl-${phase}-${Date.now()}`,
        phase,
        agentRole,
        summary,
        details,
        veritasExitCode,
        blockedByDA,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
    };
}
