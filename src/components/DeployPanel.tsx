/**
 * DeployPanel.tsx — Deploy Engine UI
 * NEXUS AI v6 — Sprint E
 *
 * Allows the user to configure a deploy hook (Netlify or Vercel)
 * and trigger a deployment manually or after Phase 11 completes.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Rocket, Settings, CheckCircle, XCircle, Loader2,
    Clock, Trash2, ExternalLink, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import {
    loadDeployConfig, saveDeployConfig, triggerDeploy,
    loadDeployLog, clearDeployLog,
    type DeployConfig, type DeployLogEntry,
} from "@/services/DeployService";
import { useOrchestratorStore } from "@/hooks/useOrchestratorStore";

export default function DeployPanel() {
    const { phases } = useOrchestratorStore();
    const phase11 = phases.find(p => p.number === '11');
    const phase11Done = phase11?.status === 'completed';

    const [config, setConfig] = useState<DeployConfig>(
        () => loadDeployConfig() ?? { provider: 'netlify', hook_url: '' }
    );
    const [configSaved, setConfigSaved] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [log, setLog] = useState<DeployLogEntry[]>(loadDeployLog);

    // Auto-trigger when Phase 11 completes (if hook configured)
    useEffect(() => {
        if (phase11Done && config.hook_url) {
            const savedLog = loadDeployLog();
            const alreadyTriggeredForPhase11 = savedLog.some(
                e => e.triggeredBy === 'phase-11' && e.status === 'success'
            );
            if (!alreadyTriggeredForPhase11) {
                handleDeploy('phase-11');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase11Done]);

    const handleSaveConfig = () => {
        if (!config.hook_url) {
            toast.error('Hook URL is required.');
            return;
        }
        if (!config.hook_url.startsWith('https://')) {
            toast.error('Hook URL must start with https://');
            return;
        }
        saveDeployConfig(config);
        setConfigSaved(true);
        toast.success('Deploy config saved.');
        setTimeout(() => setConfigSaved(false), 2000);
    };

    const handleDeploy = async (triggeredBy = 'manual') => {
        if (!config.hook_url) {
            toast.error('No deploy hook configured.');
            return;
        }
        setDeploying(true);
        try {
            await triggerDeploy(config.provider, config.hook_url, triggeredBy);
            setLog(loadDeployLog());
            toast.success(`🚀 Deploy triggered on ${config.provider}!`);
        } catch (err) {
            setLog(loadDeployLog());
            toast.error(err instanceof Error ? err.message : 'Deploy failed');
        } finally {
            setDeploying(false);
        }
    };

    const handleClearLog = () => {
        clearDeployLog();
        setLog([]);
    };

    return (
        <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold nexus-gradient-text">Deploy Engine</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Trigger production deployments to Netlify or Vercel. Auto-fires after Phase 11 completes.
                </p>
            </div>

            {/* Phase 11 Gate */}
            <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg p-4 border flex items-center gap-3 ${phase11Done
                        ? 'bg-nexus-green/5 border-nexus-green/30'
                        : 'bg-nexus-amber/5 border-nexus-amber/30'
                    }`}
            >
                {phase11Done
                    ? <CheckCircle size={20} className="text-nexus-green flex-shrink-0" />
                    : <AlertTriangle size={20} className="text-nexus-amber flex-shrink-0" />
                }
                <div>
                    <div className="text-sm font-semibold text-foreground">
                        Phase 11 — DevOps / Deploy: {phase11Done ? 'COMPLETE' : phase11?.status?.toUpperCase() ?? 'PENDING'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        {phase11Done
                            ? 'Deploy is unlocked. Manual trigger available or auto-trigger fired.'
                            : 'Deploy will auto-trigger when Phase 11 completes. Manual trigger is also available.'}
                    </div>
                </div>
            </motion.div>

            {/* Config */}
            <div className="nexus-card rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Settings size={14} className="text-primary" />
                    Deploy Hook Configuration
                </h2>

                <div className="flex gap-3">
                    {(['netlify', 'vercel'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setConfig(prev => ({ ...prev, provider: p }))}
                            className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${config.provider === p
                                    ? 'bg-primary/15 text-primary border border-primary/30'
                                    : 'bg-nexus-deep text-muted-foreground border border-nexus-border-subtle hover:border-primary/20'
                                }`}
                        >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                    ))}
                </div>

                <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase">
                        Deploy Hook URL
                    </label>
                    <input
                        value={config.hook_url}
                        onChange={e => setConfig(prev => ({ ...prev, hook_url: e.target.value }))}
                        placeholder={
                            config.provider === 'netlify'
                                ? 'https://api.netlify.com/build_hooks/...'
                                : 'https://api.vercel.com/v1/integrations/deploy/...'
                        }
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleSaveConfig}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${configSaved
                                ? 'bg-nexus-green/15 text-nexus-green border border-nexus-green/30'
                                : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                            }`}
                    >
                        {configSaved ? <CheckCircle size={14} /> : <Settings size={14} />}
                        {configSaved ? 'Saved!' : 'Save Config'}
                    </button>

                    <button
                        onClick={() => handleDeploy('manual')}
                        disabled={deploying || !config.hook_url}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-nexus-green/10 text-nexus-green border border-nexus-green/30 hover:bg-nexus-green/20 transition-colors disabled:opacity-50"
                    >
                        {deploying
                            ? <><Loader2 size={14} className="animate-spin" /> Deploying...</>
                            : <><Rocket size={14} /> Deploy Now</>
                        }
                    </button>
                </div>
            </div>

            {/* Deploy Log */}
            {log.length > 0 && (
                <div className="nexus-card rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Clock size={14} className="text-primary" />
                            Deploy History
                        </h2>
                        <button
                            onClick={handleClearLog}
                            className="ml-auto p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        {log.map((entry, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.02 }}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs border ${entry.status === 'success'
                                        ? 'bg-nexus-green/5 border-nexus-green/15'
                                        : 'bg-nexus-red/5 border-nexus-red/15'
                                    }`}
                            >
                                {entry.status === 'success'
                                    ? <CheckCircle size={11} className="text-nexus-green flex-shrink-0" />
                                    : <XCircle size={11} className="text-nexus-red flex-shrink-0" />
                                }
                                <span className="font-mono text-foreground capitalize">{entry.provider}</span>
                                <span className="text-[9px] font-mono text-muted-foreground">
                                    via {entry.triggeredBy}
                                </span>
                                <span className="text-[9px] text-muted-foreground ml-auto">
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                                {entry.error && (
                                    <span className="text-[9px] text-nexus-red truncate max-w-48" title={entry.error}>
                                        {entry.error}
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {log.length === 0 && (
                <div className="nexus-card rounded-xl p-8 text-center">
                    <Rocket size={28} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No deployments triggered yet.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                        Configure a hook URL above and click "Deploy Now" or complete Phase 11.
                    </p>
                </div>
            )}
        </div>
    );
}
