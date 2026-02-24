import { useState } from "react";
import { motion } from "framer-motion";
import { useOrchestratorStore } from "@/hooks/useOrchestratorStore";
import { orchestratorStore } from "@/stores/OrchestratorStore";
import { ApprovalRequest } from "@/hitl/ApprovalRequest";
import {
  CheckCircle, XCircle, Clock, Shield, AlertTriangle,
  Bot, MessageSquare, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";

export default function HITLPanel() {
  const { pendingApprovals, approvalHistory } = useOrchestratorStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const handleApprove = (id: string) => {
    orchestratorStore.resolveApproval(id, 'APPROVED', comment || undefined);
    setComment('');
    setExpandedId(null);
    toast.success('Approval granted — phase can proceed.');
  };

  const handleReject = (id: string) => {
    orchestratorStore.resolveApproval(id, 'REJECTED', comment || 'Rejected by user.');
    setComment('');
    setExpandedId(null);
    toast.error('Approval rejected — phase blocked.');
  };

  const statusBadge = (req: ApprovalRequest) => {
    switch (req.status) {
      case 'PENDING': return (
        <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-nexus-amber/15 text-nexus-amber">
          <Clock size={9} /> PENDING
        </span>
      );
      case 'APPROVED': return (
        <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-nexus-green/15 text-nexus-green">
          <CheckCircle size={9} /> APPROVED
        </span>
      );
      case 'REJECTED': return (
        <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-nexus-red/15 text-nexus-red">
          <XCircle size={9} /> REJECTED
        </span>
      );
      default: return null;
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold nexus-gradient-text">HITL — Human Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve/reject agent outputs before phases proceed.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="nexus-card rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Pending</div>
          <div className="text-2xl font-bold font-mono text-nexus-amber">{pendingApprovals.length}</div>
        </div>
        <div className="nexus-card rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Approved</div>
          <div className="text-2xl font-bold font-mono text-nexus-green">
            {approvalHistory.filter(r => r.status === 'APPROVED').length}
          </div>
        </div>
        <div className="nexus-card rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Rejected</div>
          <div className="text-2xl font-bold font-mono text-nexus-red">
            {approvalHistory.filter(r => r.status === 'REJECTED').length}
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock size={14} className="text-nexus-amber" />
          Pending Approvals ({pendingApprovals.length})
        </h2>

        {pendingApprovals.length === 0 && (
          <div className="nexus-card rounded-xl p-8 text-center">
            <CheckCircle size={32} className="mx-auto text-nexus-green mb-3" />
            <p className="text-sm text-muted-foreground">All clear — no pending approvals.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Approvals appear here when agents complete phases that require HITL review.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {pendingApprovals.map((req, i) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="nexus-card rounded-xl overflow-hidden border border-nexus-amber/20"
            >
              {/* Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-nexus-surface-hover transition-colors"
                onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
              >
                <Bot size={16} className="text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    Phase {req.phase} — {req.agentRole}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {new Date(req.createdAt).toLocaleString('ro-RO')}
                    {req.blockedByDA && (
                      <span className="ml-2 text-nexus-red">⚠ DA BLOCKED</span>
                    )}
                    {req.veritasExitCode !== 0 && (
                      <span className="ml-2 text-nexus-red">⚠ Veritas EXIT {req.veritasExitCode}</span>
                    )}
                  </div>
                </div>
                {statusBadge(req)}
                {expandedId === req.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>

              {/* Expanded Content */}
              {expandedId === req.id && (
                <div className="border-t border-nexus-border-subtle">
                  {/* Summary */}
                  <div className="px-4 py-3">
                    <div className="text-xs font-mono text-muted-foreground mb-1">Agent Output:</div>
                    <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-3 max-h-[300px] overflow-y-auto">
                      {req.summary}
                    </div>
                  </div>

                  {/* Warnings */}
                  {(req.blockedByDA || req.veritasExitCode !== 0) && (
                    <div className="px-4 py-2 bg-nexus-red/5 border-t border-nexus-border-subtle">
                      <div className="flex items-center gap-2 text-xs text-nexus-red">
                        <AlertTriangle size={12} />
                        <span>
                          {req.blockedByDA && "Devil's Advocate found CRITICAL issues. "}
                          {req.veritasExitCode !== 0 && `Veritas exit code: ${req.veritasExitCode}. `}
                          Proceed with caution.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Comment + Actions */}
                  <div className="px-4 py-3 border-t border-nexus-border-subtle flex gap-2">
                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add comment (optional)..."
                      className="flex-1 h-9 px-3 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-nexus-green/20 text-nexus-green text-sm font-semibold hover:bg-nexus-green/30 transition-colors"
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-nexus-red/20 text-nexus-red text-sm font-semibold hover:bg-nexus-red/30 transition-colors"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* History */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2 hover:text-primary transition-colors"
        >
          <MessageSquare size={14} />
          Approval History ({approvalHistory.length})
          {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showHistory && (
          <div className="space-y-2">
            {approvalHistory.length === 0 && (
              <p className="text-xs text-muted-foreground">No history yet.</p>
            )}
            {approvalHistory.map((req, i) => (
              <div
                key={req.id}
                className="nexus-card rounded-lg px-4 py-2 flex items-center gap-3 text-xs"
              >
                {statusBadge(req)}
                <span className="font-mono text-muted-foreground">Phase {req.phase}</span>
                <span className="text-secondary-foreground">{req.agentRole}</span>
                <span className="flex-1 truncate text-muted-foreground">{req.summary.substring(0, 80)}...</span>
                {req.resolvedBy && (
                  <span className="text-[9px] font-mono text-muted-foreground/60">
                    by {req.resolvedBy} • {req.resolvedAt ? new Date(req.resolvedAt).toLocaleTimeString('ro-RO') : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
