/**
 * RepoPanel.tsx — GitHub Repository Panel
 * NEXUS AI v6
 *
 * Lovable-style flow:
 *   1. Connect GitHub (token paste)
 *   2. Create new repo (with conflict handling)
 *   3. Push All — commits all generated phase outputs in one click
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    GitBranch, Upload, CheckCircle, XCircle, Loader2,
    Github, LogOut, Eye, EyeOff, KeyRound, Plus, Lock, Globe,
    ExternalLink, Trash2, RefreshCw, FolderGit2, Rocket
} from "lucide-react";
import { toast } from "sonner";
import {
    loadRepoConfig, saveRepoConfig,
    loadCommittedFiles, appendCommittedFile, clearCommittedFiles,
    type RepoConfig, type CommittedFile,
} from "@/services/FileWriterService";

// GitHub PAT creation URL with scopes pre-filled
const GH_TOKEN_PAGE =
    'https://github.com/settings/tokens/new?scopes=repo%2Cread%3Auser&description=NEXUS+AI+v6';
const GH_USER_KEY = 'nexus-github-user';
const NOTEBOOK_KEY = 'nexus-notebook-entries';

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

interface PmRepoCreatedDetail {
    name: string;
    html_url: string;
    default_branch?: string;
    owner?: { login?: string };
}

function loadNotebookEntries(): NotebookEntry[] {
    try {
        const raw = localStorage.getItem(NOTEBOOK_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

/** Derive a clean file path from a phase entry */
function derivePath(entry: NotebookEntry): string {
    // Try to parse a filename from a code fence header like ```tsx src/Foo.tsx
    const match = entry.code.match(/```(?:\w+)?\s+([\w/.-]+\.\w+)/);
    if (match) return match[1];
    const ext = entry.language === 'typescript' || entry.language === 'tsx' ? 'ts'
        : entry.language === 'markdown' ? 'md'
            : entry.language || 'txt';
    return `nexus/phase-${entry.phase}-${entry.sourceAgent.replace(/\s+/g, '-')}.${ext}`;
}

function toBase64Utf8(content: string): string {
    const bytes = new TextEncoder().encode(content);
    const chunkSize = 0x8000;
    let binary = '';
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
}

/** GitHub REST API helpers */
async function ghFetch(path: string, token: string, method = 'GET', body?: object) {
    const resp = await fetch(`https://api.github.com${path}`, {
        method,
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return resp;
}

async function ghJson<T>(path: string, token: string, method = 'GET', body?: object): Promise<T> {
    const resp = await ghFetch(path, token, method, body);
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { message?: string };
        throw { status: resp.status, message: err.message ?? `HTTP ${resp.status}` };
    }
    return resp.json() as Promise<T>;
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function RepoPanel() {
    // Auth
    const [ghUser, setGhUser] = useState<{ login: string; avatar_url: string } | null>(() => {
        try { return JSON.parse(localStorage.getItem(GH_USER_KEY) || 'null'); } catch { return null; }
    });
    const [config, setConfig] = useState<RepoConfig>(() => loadRepoConfig() ?? { owner: '', repo: '', branch: 'main', token: '' });
    const [tokenInput, setTokenInput] = useState('');
    const [showInput, setShowInput] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [validating, setValidating] = useState(false);

    // Create repo
    const [newRepoName, setNewRepoName] = useState('');
    const [newRepoDesc, setNewRepoDesc] = useState('');
    const [repoPrivate, setRepoPrivate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createdRepo, setCreatedRepo] = useState<{ name: string; html_url: string } | null>(null);
    const [repoError, setRepoError] = useState('');

    // Push
    const [pushing, setPushing] = useState(false);
    const [pushProgress, setPushProgress] = useState<{ done: number; total: number } | null>(null);
    const [committedFiles, setCommittedFiles] = useState<CommittedFile[]>(loadCommittedFiles);
    const [entries, setEntries] = useState<NotebookEntry[]>(loadNotebookEntries);

    const isConnected = !!config.token && !!ghUser;
    const hasRepo = !!config.repo && !!config.owner;
    const eligibleEntries = entries.filter(e => e.overallStatus === 'passed' || e.overallStatus === 'issues');

    useEffect(() => {
        const refreshNotebook = () => setEntries(loadNotebookEntries());
        const refreshCommitted = () => setCommittedFiles(loadCommittedFiles());

        const handleRepoCreated = (event: Event) => {
            const detail = (event as CustomEvent<PmRepoCreatedDetail>).detail;
            if (!detail?.name) return;
            setCreatedRepo({ name: detail.name, html_url: detail.html_url });
            setConfig(prev => {
                const next = {
                    ...prev,
                    owner: detail.owner?.login ?? prev.owner,
                    repo: detail.name,
                    branch: detail.default_branch || prev.branch || 'main',
                };
                saveRepoConfig(next);
                return next;
            });
            toast.success(`PM created repository ${detail.name}`);
        };

        refreshNotebook();
        refreshCommitted();

        window.addEventListener('nexus-notebook-submit', refreshNotebook);
        window.addEventListener('nexus-pm-repo-created', handleRepoCreated as EventListener);
        window.addEventListener('focus', refreshNotebook);

        return () => {
            window.removeEventListener('nexus-notebook-submit', refreshNotebook);
            window.removeEventListener('nexus-pm-repo-created', handleRepoCreated as EventListener);
            window.removeEventListener('focus', refreshNotebook);
        };
    }, []);

    // ── Auth ──────────────────────────────────────────────────────────────────
    const validateToken = useCallback(async (token: string) => {
        if (token.length < 10) return;
        setValidating(true);
        try {
            const user = await ghJson<{ login: string; avatar_url: string }>('/user', token);
            const newConfig = { ...config, token, owner: user.login };
            setConfig(newConfig);
            saveRepoConfig(newConfig);
            setGhUser({ login: user.login, avatar_url: user.avatar_url });
            localStorage.setItem(GH_USER_KEY, JSON.stringify({ login: user.login, avatar_url: user.avatar_url }));
            setShowInput(false);
            setTokenInput('');
            toast.success(`✓ Connected as ${user.login}`);
        } catch {
            toast.error('Invalid token — check permissions (repo + read:user required).');
        } finally {
            setValidating(false);
        }
    }, [config]);

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData('text').trim();
        if (pasted.startsWith('ghp_') || pasted.startsWith('github_pat_')) {
            setTokenInput(pasted);
            setTimeout(() => validateToken(pasted), 50);
        }
    };

    const handleDisconnect = () => {
        const cleared = { owner: '', repo: '', branch: 'main', token: '' };
        setConfig(cleared);
        saveRepoConfig(cleared);
        setGhUser(null);
        localStorage.removeItem(GH_USER_KEY);
        setCreatedRepo(null);
        toast.success('Disconnected from GitHub');
    };

    // ── Create Repo ───────────────────────────────────────────────────────────
    const handleCreateRepo = async () => {
        if (!newRepoName.trim()) { toast.error('Repository name is required.'); return; }
        setCreating(true);
        setRepoError('');
        try {
            const repo = await ghJson<{ name: string; html_url: string; default_branch: string }>(
                '/user/repos', config.token, 'POST',
                {
                    name: newRepoName.trim(),
                    description: newRepoDesc.trim() || `Generated by NEXUS AI v6`,
                    private: repoPrivate,
                    auto_init: true,  // creates main branch with README
                }
            );
            const newConfig = { ...config, repo: repo.name, branch: repo.default_branch };
            setConfig(newConfig);
            saveRepoConfig(newConfig);
            setCreatedRepo({ name: repo.name, html_url: repo.html_url });
            setNewRepoName('');
            toast.success(`Repository "${repo.name}" created on GitHub!`);
        } catch (err: unknown) {
            const e = err as { status?: number; message?: string };
            if (e.status === 422) {
                setRepoError(`A repository named "${newRepoName}" already exists on your account. Please choose a different name.`);
            } else if (e.status === 401) {
                setRepoError('Token expired or missing "repo" scope. Please reconnect GitHub.');
            } else {
                setRepoError(e.message ?? 'Failed to create repository.');
            }
        } finally {
            setCreating(false);
        }
    };

    // ── Push All ──────────────────────────────────────────────────────────────
    const handlePushAll = async () => {
        if (!hasRepo) { toast.error('Create or select a repository first.'); return; }
        if (eligibleEntries.length === 0) { toast.error('No entries in Notebook yet. Run the pipeline first.'); return; }

        setPushing(true);
        setPushProgress({ done: 0, total: eligibleEntries.length });

        const branch = config.branch || 'main';
        let successCount = 0;

        for (let i = 0; i < eligibleEntries.length; i++) {
            const entry = eligibleEntries[i];
            const path = derivePath(entry);

            try {
                // Get existing SHA if file already exists (for updates)
                let existingSha: string | undefined;
                try {
                    const existing = await ghJson<{ sha: string }>(
                        `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${branch}`,
                        config.token
                    );
                    existingSha = existing.sha;
                } catch { /* new file */ }

                const body: Record<string, string> = {
                    message: `[NEXUS AI] Phase ${entry.phase}: ${entry.description || entry.sourceAgent}`,
                    content: toBase64Utf8(entry.code),
                    branch,
                };
                if (existingSha) body.sha = existingSha;

                const result = await ghJson<{
                    content?: { sha?: string; html_url?: string; path?: string };
                    commit?: { sha?: string };
                }>(
                    `/repos/${config.owner}/${config.repo}/contents/${path}`,
                    config.token, 'PUT', body
                );

                const committed: CommittedFile = {
                    path: result.content?.path ?? path,
                    message: `Phase ${entry.phase}: ${entry.description || entry.sourceAgent}`,
                    sha: result.content?.sha ?? result.commit?.sha ?? '',
                    html_url: result.content?.html_url ?? `https://github.com/${config.owner}/${config.repo}/blob/${branch}/${path}`,
                    phase: entry.phase,
                    sourceAgent: entry.sourceAgent,
                    timestamp: new Date().toLocaleTimeString(),
                };
                appendCommittedFile(committed);
                successCount++;
            } catch (err: unknown) {
                const e = err as { message?: string };
                console.error(`[RepoPanel] Failed to push ${path}:`, e.message);
            }

            setPushProgress({ done: i + 1, total: eligibleEntries.length });
        }

        setCommittedFiles(loadCommittedFiles());
        setPushing(false);
        setPushProgress(null);

        if (successCount === eligibleEntries.length) {
            toast.success(`✓ All ${successCount} files pushed to GitHub!`);
        } else {
            toast.warning(`Pushed ${successCount}/${eligibleEntries.length} files. Check console for errors.`);
        }
    };

    // ── Select existing repo ──────────────────────────────────────────────────
    const [existingRepo, setExistingRepo] = useState('');
    const handleSelectRepo = () => {
        if (!existingRepo.trim()) { toast.error('Enter a repository name.'); return; }
        const newConfig = { ...config, repo: existingRepo.trim() };
        setConfig(newConfig);
        saveRepoConfig(newConfig);
        toast.success(`Using repository: ${config.owner}/${existingRepo.trim()}`);
        setExistingRepo('');
    };

    return (
        <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold nexus-gradient-text">GitHub Repository</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Create a repo and push your entire generated project to GitHub in one click.
                </p>
            </div>

            {/* ── 1. Auth ──────────────────────────────────────────────────── */}
            <div className="nexus-card rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Github size={14} className="text-primary" />
                    GitHub Account
                </h2>

                {isConnected && ghUser ? (
                    <div className="flex items-center gap-3">
                        <img src={ghUser.avatar_url} alt={ghUser.login}
                            className="w-9 h-9 rounded-full border border-nexus-green/30" />
                        <div>
                            <p className="text-sm font-semibold">{ghUser.login}</p>
                            <p className="text-[10px] font-mono text-nexus-green flex items-center gap-1">
                                <CheckCircle size={9} /> Authenticated
                            </p>
                        </div>
                        <button onClick={handleDisconnect}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive border border-border transition-colors">
                            <LogOut size={11} /> Disconnect
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-nexus-deep border border-nexus-border-subtle">
                            <span className="w-5 h-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center shrink-0">1</span>
                            <p className="text-xs text-muted-foreground flex-1">
                                Click to open GitHub — <span className="text-primary font-mono">repo</span> scope pre-selectat
                            </p>
                            <a href={GH_TOKEN_PAGE} target="_blank" rel="noopener noreferrer"
                                onClick={() => setTimeout(() => setShowInput(true), 400)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-[#24292f] text-white hover:bg-[#1c2128] border border-[#30363d] transition-colors">
                                <Github size={14} /> Open GitHub
                            </a>
                        </div>
                        <AnimatePresence>
                            {showInput && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-nexus-deep border border-primary/30">
                                    <span className="w-5 h-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center shrink-0">2</span>
                                    <p className="text-xs text-muted-foreground shrink-0">Pe GitHub → Generate → Paste:</p>
                                    <div className="relative flex-1">
                                        <input type={showToken ? 'text' : 'password'} value={tokenInput}
                                            onChange={e => setTokenInput(e.target.value)}
                                            onPaste={handlePaste}
                                            placeholder="ghp_... (auto-detectat)"
                                            autoFocus
                                            className="w-full px-3 py-1.5 pr-8 rounded-lg bg-black/40 border border-primary/30 text-sm font-mono focus:outline-none focus:border-primary transition-colors" />
                                        <button onClick={() => setShowToken(!showToken)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                                        </button>
                                    </div>
                                    <button onClick={() => validateToken(tokenInput)} disabled={validating || tokenInput.length < 10}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50">
                                        {validating ? <><Loader2 size={11} className="animate-spin" /> Checking…</> : <><KeyRound size={11} /> Connect</>}
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {!showInput && (
                            <button onClick={() => setShowInput(true)} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                                Am deja un token
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── 2. Create / Select Repo ──────────────────────────────────── */}
            <AnimatePresence>
                {isConnected && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="nexus-card rounded-xl p-5 space-y-4">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <FolderGit2 size={14} className="text-primary" />
                            Repository
                            {hasRepo && (
                                <span className="ml-auto text-[10px] font-mono text-nexus-green flex items-center gap-1">
                                    <CheckCircle size={9} /> {config.owner}/{config.repo}
                                </span>
                            )}
                        </h2>

                        {/* Created confirmation */}
                        {createdRepo && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nexus-green/10 border border-nexus-green/25 text-xs">
                                <CheckCircle size={12} className="text-nexus-green shrink-0" />
                                <span className="text-nexus-green font-mono">Repository "{createdRepo.name}" creat cu succes!</span>
                                <a href={createdRepo.html_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-primary">
                                    <ExternalLink size={11} />
                                </a>
                            </div>
                        )}

                        {/* Error */}
                        {repoError && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/25 text-xs text-destructive">
                                <XCircle size={12} className="shrink-0 mt-0.5" />
                                {repoError}
                            </div>
                        )}

                        {/* Create new */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase">Create new repository</label>
                            <div className="flex gap-2">
                                <input value={newRepoName} onChange={e => { setNewRepoName(e.target.value); setRepoError(''); }}
                                    placeholder="nexus-project-name"
                                    onKeyDown={e => e.key === 'Enter' && handleCreateRepo()}
                                    className="flex-1 px-3 py-2 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-sm focus:outline-none focus:border-primary/50 transition-colors" />
                                <button onClick={() => setRepoPrivate(!repoPrivate)}
                                    title={repoPrivate ? 'Private' : 'Public'}
                                    className={`px-3 py-2 rounded-lg text-xs border transition-colors ${repoPrivate ? 'border-nexus-amber/40 text-nexus-amber bg-nexus-amber/10' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
                                    {repoPrivate ? <Lock size={13} /> : <Globe size={13} />}
                                </button>
                                <button onClick={handleCreateRepo} disabled={creating || !newRepoName.trim()}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50">
                                    {creating ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : <><Plus size={13} /> Create Repo</>}
                                </button>
                            </div>
                            <input value={newRepoDesc} onChange={e => setNewRepoDesc(e.target.value)}
                                placeholder="Description (optional)"
                                className="w-full px-3 py-2 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-sm text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors" />
                        </div>

                        {/* Use existing */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase">Or use an existing repository</label>
                            <div className="flex gap-2">
                                <span className="px-3 py-2 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-xs text-muted-foreground">{config.owner}/</span>
                                <input value={existingRepo} onChange={e => setExistingRepo(e.target.value)}
                                    placeholder="existing-repo"
                                    onKeyDown={e => e.key === 'Enter' && handleSelectRepo()}
                                    className="flex-1 px-3 py-2 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-sm focus:outline-none focus:border-primary/50 transition-colors" />
                                <button onClick={handleSelectRepo} disabled={!existingRepo.trim()}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-nexus-deep border border-nexus-border-subtle hover:border-primary/40 transition-colors disabled:opacity-50">
                                    <CheckCircle size={13} /> Select
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── 3. Push All ──────────────────────────────────────────────── */}
            <AnimatePresence>
                {isConnected && hasRepo && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="nexus-card rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Rocket size={14} className="text-primary" />
                                Push Project to GitHub
                                <span className="text-[10px] font-mono text-muted-foreground">
                                    {eligibleEntries.length} files
                                </span>
                            </h2>
                        </div>

                        {eligibleEntries.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">
                                Run the pipeline first — generated phases will appear here automatically.
                            </p>
                        ) : (
                            <>
                                {/* File list preview */}
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {eligibleEntries.map(e => (
                                        <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 rounded bg-nexus-deep text-[11px] font-mono">
                                            <span className="text-muted-foreground">Phase {e.phase}</span>
                                            <span className="text-foreground flex-1 truncate">{derivePath(e)}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${e.overallStatus === 'passed' ? 'bg-nexus-green/10 text-nexus-green' : 'bg-nexus-amber/10 text-nexus-amber'}`}>
                                                {e.overallStatus.toUpperCase()}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Progress */}
                                {pushing && pushProgress && (
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                            <span>Uploading…</span>
                                            <span>{pushProgress.done}/{pushProgress.total}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-nexus-deep overflow-hidden">
                                            <motion.div className="h-full bg-primary rounded-full"
                                                animate={{ width: `${(pushProgress.done / pushProgress.total) * 100}%` }}
                                                transition={{ duration: 0.3 }} />
                                        </div>
                                    </div>
                                )}

                                {/* Push button */}
                                <button onClick={handlePushAll} disabled={pushing}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary/20 to-nexus-purple/20 text-primary border border-primary/30 hover:from-primary/30 hover:to-nexus-purple/30 transition-all disabled:opacity-60">
                                    {pushing
                                        ? <><Loader2 size={15} className="animate-spin" /> Pushing to GitHub…</>
                                        : <><Upload size={15} /> Push All to {config.owner}/{config.repo}</>}
                                </button>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── 4. Commit History ────────────────────────────────────────── */}
            {committedFiles.length > 0 && (
                <div className="nexus-card rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <GitBranch size={14} className="text-nexus-green" />
                            Push History
                        </h2>
                        <button onClick={() => { clearCommittedFiles(); setCommittedFiles([]); }}
                            className="ml-auto p-1 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 size={13} />
                        </button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {committedFiles.map((file, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.02 }}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-nexus-green/5 border border-nexus-green/15 text-xs">
                                <CheckCircle size={11} className="text-nexus-green shrink-0" />
                                <span className="font-mono text-foreground truncate flex-1">{file.path}</span>
                                <span className="text-[9px] font-mono text-muted-foreground">{file.sha.slice(0, 7)}</span>
                                <a href={file.html_url} target="_blank" rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/70">
                                    <ExternalLink size={11} />
                                </a>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
