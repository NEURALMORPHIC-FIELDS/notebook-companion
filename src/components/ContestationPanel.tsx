/**
 * ContestationPanel.tsx — Devil's Advocate contestation review UI
 * NEXUS AI v6 — Pre-HITL Review (§9 ARCHITECTURE.md)
 *
 * ARCHITECTURE.md §9:
 *   "Devil's Advocate reviews BEFORE HITL is shown to user.
 *    Output displayed with severity badges: CRITICAL / HIGH / MEDIUM.
 *    If blocksApproval = true, HITL Approve button is disabled."
 *
 * Issue parsing: reads DA output looking for CRITICAL:/HIGH:/MEDIUM: line prefixes.
 * Visual design: dark themed, severity-color-coded, expandable list.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

export interface DAIssue {
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    description: string;
}

export interface ContestationResult {
    contestedAgent: string;
    phase: string;
    blocksApproval: boolean;
    issues: DAIssue[];
    rawOutput: string;
}

// ── Parse structured DA output ────────────────────────────────────────────────

export function parseDaOutput(raw: string, contestedAgent: string, phase: string): ContestationResult {
    const issues: DAIssue[] = [];
    const lines = raw.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (/^CRITICAL:\s+.+/i.test(trimmed)) {
            issues.push({ severity: 'CRITICAL', description: trimmed.replace(/^CRITICAL:\s*/i, '') });
        } else if (/^HIGH:\s+.+/i.test(trimmed)) {
            issues.push({ severity: 'HIGH', description: trimmed.replace(/^HIGH:\s*/i, '') });
        } else if (/^MEDIUM:\s+.+/i.test(trimmed)) {
            issues.push({ severity: 'MEDIUM', description: trimmed.replace(/^MEDIUM:\s*/i, '') });
        }
    }

    const blocksApproval = issues.some(i => i.severity === 'CRITICAL');

    return { contestedAgent, phase, blocksApproval, issues, rawOutput: raw };
}

// ── Severity config ───────────────────────────────────────────────────────────

const SEV_CONFIG = {
    CRITICAL: { color: 'text-nexus-red bg-nexus-red/10 border-nexus-red/30', Icon: AlertCircle, label: 'CRITICAL' },
    HIGH: { color: 'text-nexus-amber bg-nexus-amber/10 border-nexus-amber/30', Icon: AlertTriangle, label: 'HIGH' },
    MEDIUM: { color: 'text-foreground bg-foreground/5 border-foreground/10', Icon: Info, label: 'MEDIUM' },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContestationPanel({ result }: { result: ContestationResult }) {
    const [showRaw, setShowRaw] = useState(false);

    const criticalCount = result.issues.filter(i => i.severity === 'CRITICAL').length;
    const highCount = result.issues.filter(i => i.severity === 'HIGH').length;
    const mediumCount = result.issues.filter(i => i.severity === 'MEDIUM').length;

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <Flame size={14} className={result.blocksApproval ? 'text-nexus-red' : 'text-nexus-amber'} />
                    <h3 className="text-sm font-semibold text-foreground">Devil's Advocate Review</h3>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                    {result.contestedAgent} · Phase {result.phase}
                </span>
                {result.blocksApproval ? (
                    <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-nexus-red/15 text-nexus-red border border-nexus-red/30">
                        <AlertCircle size={10} /> BLOCKS APPROVAL
                    </span>
                ) : result.issues.length === 0 ? (
                    <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-nexus-green/15 text-nexus-green border border-nexus-green/30">
                        <CheckCircle2 size={10} /> NO ISSUES FOUND
                    </span>
                ) : (
                    <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-nexus-amber/15 text-nexus-amber border border-nexus-amber/30">
                        <AlertTriangle size={10} /> ISSUES FOUND
                    </span>
                )}
            </div>

            {/* Summary badges */}
            {result.issues.length > 0 && (
                <div className="flex items-center gap-2">
                    {criticalCount > 0 && <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-nexus-red/10 text-nexus-red border border-nexus-red/20">{criticalCount} Critical</span>}
                    {highCount > 0 && <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-nexus-amber/10 text-nexus-amber border border-nexus-amber/20">{highCount} High</span>}
                    {mediumCount > 0 && <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-foreground/5 text-muted-foreground border border-foreground/10">{mediumCount} Medium</span>}
                </div>
            )}

            {/* Issue list */}
            {result.issues.length > 0 ? (
                <div className="space-y-2">
                    {result.issues.map((issue, i) => {
                        const cfg = SEV_CONFIG[issue.severity];
                        const Icon = cfg.Icon;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className={`flex items-start gap-2 p-3 rounded-lg border ${cfg.color}`}
                            >
                                <Icon size={13} className="mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <span className="text-[9px] font-mono font-bold mr-2 opacity-70">{cfg.label}</span>
                                    <span className="text-xs">{issue.description}</span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-xs text-muted-foreground text-center py-3">
                    Devil's Advocate found no issues. All checks passed.
                </p>
            )}

            {/* Raw output toggle */}
            <button
                onClick={() => setShowRaw(!showRaw)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
                {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {showRaw ? 'Hide' : 'Show'} raw DA output
            </button>
            <AnimatePresence>
                {showRaw && (
                    <motion.pre
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="text-[10px] font-mono bg-nexus-deep rounded-lg p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap"
                    >
                        {result.rawOutput}
                    </motion.pre>
                )}
            </AnimatePresence>
        </div>
    );
}
