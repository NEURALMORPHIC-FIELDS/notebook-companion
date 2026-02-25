/**
 * KnownIncompletePanel.tsx — HITL panel: first visible section
 * NEXUS AI v6 — Rule #10, Phase Approval Panel (§9 ARCHITECTURE.md)
 *
 * ARCHITECTURE.md §9:
 *   "Known Incomplete — cumulative registry.
 *    First visible element in HITL panel."
 *
 * This panel displays BEFORE the approve/reject buttons.
 * If Veritas exit_code != 0 AND the list is empty, shows a DISCREPANCY warning —
 * the agent is claiming progress without documenting what is broken.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertTriangle, CheckCircle2, XCircle, Clock,
    Bug, ChevronDown, ChevronUp, ShieldAlert, type LucideIcon
} from "lucide-react";
import { knownIncompleteRegistry, type KnownIncompleteItem, type IncompleteState } from "@/behavioral/KnownIncompleteRegistry";
import { VeritasRunner } from "@/veritas/VeritasRunner";

// ── State badge config ────────────────────────────────────────────────────────

const STATE_CONFIG: Record<IncompleteState, { label: string; color: string; Icon: LucideIcon }> = {
    DISABLED: { label: 'Disabled', color: 'text-nexus-red   bg-nexus-red/10', Icon: XCircle },
    BUGGY: { label: 'Buggy', color: 'text-nexus-red   bg-nexus-red/10', Icon: Bug },
    UNVERIFIED: { label: 'Unverified', color: 'text-nexus-amber bg-nexus-amber/10', Icon: AlertTriangle },
    PARTIAL: { label: 'Partial', color: 'text-nexus-amber bg-nexus-amber/10', Icon: Clock },
    RESOLVED: { label: 'Resolved', color: 'text-nexus-green bg-nexus-green/10', Icon: CheckCircle2 },
};

// ── Item row ─────────────────────────────────────────────────────────────────

function IncompleteRow({ item, onResolve }: {
    item: KnownIncompleteItem;
    onResolve: (id: string, evidence: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [evidence, setEvidence] = useState('');
    const cfg = STATE_CONFIG[item.state];
    const Icon = cfg.Icon;

    return (
        <div className="border border-nexus-border-subtle rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-nexus-surface-hover transition-colors text-left"
            >
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${cfg.color}`}>
                    <Icon size={10} />
                    {cfg.label}
                </span>
                <span className="flex-1 text-xs text-foreground truncate">{item.item}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{item.id}</span>
                {expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-nexus-border-subtle px-4 py-3 space-y-2 bg-nexus-deep/50"
                    >
                        <div className="text-[10px] text-muted-foreground">
                            <span className="font-mono text-primary">Phase:</span> {item.phase}
                            {item.affectedFunction && <> · <span className="font-mono text-primary">FAS:</span> {item.affectedFunction}</>}
                            · <span className="font-mono text-primary">Added:</span> {new Date(item.addedAt).toLocaleDateString()}
                        </div>
                        <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Impact:</span> {item.impact}</p>

                        {item.state === 'RESOLVED' && item.resolutionEvidence && (
                            <p className="text-xs text-nexus-green">
                                <span className="font-semibold">Evidence:</span> {item.resolutionEvidence}
                            </p>
                        )}

                        {item.state !== 'RESOLVED' && (
                            <div className="flex gap-2 mt-2">
                                <input
                                    value={evidence}
                                    onChange={e => setEvidence(e.target.value)}
                                    placeholder="Resolution evidence (mandatory)..."
                                    className="flex-1 text-xs bg-muted border border-nexus-border-subtle rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-nexus-green/50"
                                />
                                <button
                                    onClick={() => { if (evidence.trim()) { onResolve(item.id, evidence); setEvidence(''); setExpanded(false); } }}
                                    disabled={!evidence.trim()}
                                    className="px-3 py-1.5 rounded text-xs bg-nexus-green/10 text-nexus-green hover:bg-nexus-green/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Mark Resolved
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function KnownIncompletePanel({ veritasExitCode }: { veritasExitCode?: number }) {
    const [items, setItems] = useState<KnownIncompleteItem[]>(() => knownIncompleteRegistry.getAll());
    const exitCode = veritasExitCode ?? VeritasRunner.loadReport()?.exit_code ?? -1;
    const unresolved = items.filter(i => i.state !== 'RESOLVED');
    const isDiscrepancy = exitCode !== 0 && unresolved.length === 0 && exitCode !== -1;

    const handleResolve = (id: string, evidence: string) => {
        knownIncompleteRegistry.resolve(id, evidence);
        setItems(knownIncompleteRegistry.getAll());
    };

    const summary = knownIncompleteRegistry.getSummary();

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className={unresolved.length > 0 ? 'text-nexus-amber' : 'text-nexus-green'} />
                    <h3 className="text-sm font-semibold text-foreground">Known Incomplete</h3>
                    <span className="text-[10px] font-mono text-muted-foreground">append-only registry</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {(['DISABLED', 'BUGGY', 'UNVERIFIED', 'PARTIAL'] as IncompleteState[]).map(state => (
                        summary[state] > 0 && (
                            <span key={state} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${STATE_CONFIG[state].color}`}>
                                {summary[state]} {STATE_CONFIG[state].label}
                            </span>
                        )
                    ))}
                    {summary.RESOLVED > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded text-nexus-green bg-nexus-green/10">
                            {summary.RESOLVED} Resolved
                        </span>
                    )}
                </div>
            </div>

            {/* Discrepancy Warning */}
            {isDiscrepancy && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-nexus-red/10 border border-nexus-red/30">
                    <ShieldAlert size={14} className="text-nexus-red mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-nexus-red">DISCREPANCY DETECTED</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            Veritas exit_code ≠ 0 but Known Incomplete is empty.
                            The agent is reporting progress without documenting what is broken.
                            This violates NEXUS AI Rule #10.
                        </p>
                    </div>
                </div>
            )}

            {/* Items list */}
            {items.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                    No Known Incomplete items recorded yet.
                    {exitCode !== 0 && <span className="block text-nexus-amber mt-1">⚠ Veritas exit_code ≠ 0 — items should be documented here.</span>}
                </div>
            ) : (
                <div className="space-y-2">
                    {/* Show unresolved first */}
                    {unresolved.map(item => (
                        <IncompleteRow key={item.id} item={item} onResolve={handleResolve} />
                    ))}
                    {/* Resolved items (collapsed by default via initial state=false) */}
                    {items.filter(i => i.state === 'RESOLVED').map(item => (
                        <IncompleteRow key={item.id} item={item} onResolve={handleResolve} />
                    ))}
                </div>
            )}
        </div>
    );
}
