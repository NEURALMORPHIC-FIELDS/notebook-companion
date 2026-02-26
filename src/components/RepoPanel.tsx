/**
 * RepoPanel.tsx — GitHub Repository Writer Panel
 * NEXUS AI v6 — Sprint B
 *
 * Allows the user to configure a GitHub repo (owner/repo/branch/token)
 * and write generated code files directly to GitHub from the Notebook entries.
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    GitBranch, Upload, CheckCircle, XCircle, Loader2,
    Settings, ExternalLink, Trash2, Lock, Eye, EyeOff
} from "lucide-react";
import { toast } from "sonner";
import {
    loadRepoConfig, saveRepoConfig, writeFile,
    loadCommittedFiles, appendCommittedFile, clearCommittedFiles,
    type RepoConfig, type CommittedFile,
} from "@/services/FileWriterService";

// CodeEntry shape from NotebookPanel (subset we need)
interface NotebookEntry {
    id: string;
    sourceAgent: string;
    phase: string;
    code: string;
    language: string;
    description: string;
    overallStatus: string;
    timestamp: string;
}

const NOTEBOOK_KEY = 'nexus-notebook-entries';

function loadNotebookEntries(): NotebookEntry[] {
    try {
        const raw = localStorage.getItem(NOTEBOOK_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFilePath(entry: NotebookEntry): string {
    // Try to extract filename from code fence headers like ```typescript src/Foo.tsx
    const match = entry.code.match(/```(?:\w+)?\s+([\w/\\.\-]+\.\w+)/);
    if (match) return match[1];
    const langExt: Record<string, string> = {
        typescript: 'ts', javascript: 'js', tsx: 'tsx', jsx: 'jsx',
        python: 'py', css: 'css', html: 'html', json: 'json',
    };
    const ext = langExt[entry.language] ?? 'ts';
    return `src/generated/phase-${entry.phase}-${entry.id}.${ext}`;
}

// ═══════════════════════════════════════════════════════════════════════

export default function RepoPanel() {
    const [config, setConfig] = useState<RepoConfig>(() => loadRepoConfig() ?? {
        owner: '', repo: '', branch: 'main', token: '',
    });
    const [showToken, setShowToken] = useState(false);
    const [configSaved, setConfigSaved] = useState(false);
    const [committedFiles, setCommittedFiles] = useState<CommittedFile[]>(loadCommittedFiles);
    const [entries, setEntries] = useState<NotebookEntry[]>(loadNotebookEntries);
    const [writing, setWriting] = useState<Record<string, boolean>>({});

    // Refresh notebook entries from localStorage when panel mounts
    useEffect(() => {
        setEntries(loadNotebookEntries());
        setCommittedFiles(loadCommittedFiles());
    }, []);

    const handleSaveConfig = () => {
        if (!config.owner || !config.repo || !config.token) {
            toast.error('Owner, repo, and token are required.');
            return;
        }
        saveRepoConfig(config);
        setConfigSaved(true);
        toast.success('Repo config saved.');
        setTimeout(() => setConfigSaved(false), 2000);
    };

    const handleWrite = useCallback(async (entry: NotebookEntry) => {
        setWriting(prev => ({ ...prev, [entry.id]: true }));
        const path = extractFilePath(entry);
        try {
            const result = await writeFile({
                path,
                content: entry.code,
                message: `[NEXUS] Phase ${entry.phase}: ${entry.description || entry.sourceAgent}`,
            }, config);

            const committed: CommittedFile = {
                path: result.path,
                message: `Phase ${entry.phase}: ${entry.description || entry.sourceAgent}`,
                sha: result.sha,
                html_url: result.html_url,
                phase: entry.phase,
                sourceAgent: entry.sourceAgent,
                timestamp: new Date().toLocaleTimeString(),
            };
            appendCommittedFile(committed);
            setCommittedFiles(loadCommittedFiles());
            toast.success(`Committed: ${result.path}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Write failed';
            toast.error(msg);
        } finally {
            setWriting(prev => ({ ...prev, [entry.id]: false }));
        }
    }, [config]);

    const handleClearLog = () => {
        clearCommittedFiles();
        setCommittedFiles([]);
    };

    // Only show entries that passed review
    const eligibleEntries = entries.filter(e =>
        e.overallStatus === 'passed' || e.overallStatus === 'issues'
    );

    return (
        <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold nexus-gradient-text">GitHub File Writer</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Write generated code from the Agent Notebook directly to your GitHub repository.
                </p>
            </div>

            {/* Repo Config */}
            <div className="nexus-card rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Settings size={14} className="text-primary" />
                    Repository Configuration
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-mono text-muted-foreground uppercase">Owner</label>
                        <input
                            value={config.owner}
                            onChange={e => setConfig(prev => ({ ...prev, owner: e.target.value }))}
                            placeholder="e.g. my-org"
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-mono text-muted-foreground uppercase">Repository</label>
                        <input
                            value={config.repo}
                            onChange={e => setConfig(prev => ({ ...prev, repo: e.target.value }))}
                            placeholder="e.g. my-app"
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-mono text-muted-foreground uppercase">Branch</label>
                        <input
                            value={config.branch}
                            onChange={e => setConfig(prev => ({ ...prev, branch: e.target.value }))}
                            placeholder="main"
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1">
                            <Lock size={10} /> GitHub Token (PAT)
                        </label>
                        <div className="relative mt-1">
                            <input
                                type={showToken ? 'text' : 'password'}
                                value={config.token}
                                onChange={e => setConfig(prev => ({ ...prev, token: e.target.value }))}
                                placeholder="ghp_..."
                                className="w-full px-3 py-2 pr-9 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                            />
                            <button
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                        </div>
                    </div>
                </div>
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
            </div>

            {/* Notebook Entries — eligible for commit */}
            <div className="nexus-card rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <GitBranch size={14} className="text-primary" />
                    Reviewed Code — Ready to Commit
                    <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                        {eligibleEntries.length} eligible
                    </span>
                </h2>

                {eligibleEntries.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                        No reviewed code yet. Run the review pipeline in the Notebook tab first.
                    </p>
                )}

                {eligibleEntries.map((entry, idx) => (
                    <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg bg-nexus-deep border border-nexus-border-subtle"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-foreground truncate">
                                {extractFilePath(entry)}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                {entry.sourceAgent} · Phase {entry.phase} · {entry.timestamp}
                            </div>
                        </div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${entry.overallStatus === 'passed'
                                ? 'bg-nexus-green/10 text-nexus-green'
                                : 'bg-nexus-amber/10 text-nexus-amber'
                            }`}>
                            {entry.overallStatus.toUpperCase()}
                        </span>
                        <button
                            onClick={() => handleWrite(entry)}
                            disabled={writing[entry.id] || !config.owner || !config.token}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                            {writing[entry.id]
                                ? <><Loader2 size={11} className="animate-spin" /> Writing...</>
                                : <><Upload size={11} /> Commit</>}
                        </button>
                    </motion.div>
                ))}
            </div>

            {/* Committed Files Log */}
            {committedFiles.length > 0 && (
                <div className="nexus-card rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <CheckCircle size={14} className="text-nexus-green" />
                            Commit History
                        </h2>
                        <button
                            onClick={handleClearLog}
                            className="ml-auto p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        {committedFiles.map((file, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.02 }}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-nexus-green/5 border border-nexus-green/15 text-xs"
                            >
                                <CheckCircle size={11} className="text-nexus-green flex-shrink-0" />
                                <span className="font-mono text-foreground truncate flex-1">{file.path}</span>
                                <span className="text-[9px] font-mono text-muted-foreground truncate max-w-24">{file.sha.slice(0, 7)}</span>
                                <span className="text-[9px] text-muted-foreground">{file.timestamp}</span>
                                <a
                                    href={file.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/70 transition-colors"
                                >
                                    <ExternalLink size={11} />
                                </a>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* No code submitted */}
            {entries.length === 0 && (
                <div className="nexus-card rounded-xl p-10 text-center">
                    <XCircle size={28} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                        No code in Notebook yet. Switch to the Notebook tab and simulate an agent submission.
                    </p>
                </div>
            )}
        </div>
    );
}
