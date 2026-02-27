/**
 * FileWriterService.ts — GitHub file writer
 * NEXUS AI v6 — Sprint B
 *
 * Writes files DIRECTLY to GitHub REST API from the browser.
 * No Supabase edge function needed — token never leaves the browser.
 */

const REPO_CONFIG_KEY = 'nexus-repo-config';

export interface RepoConfig {
    owner: string;
    repo: string;
    branch: string;
    token: string;
}

export interface WriteFileParams {
    path: string;
    content: string;
    message: string;
}

export interface WriteFileResult {
    committed: true;
    sha: string;
    html_url: string;
    path: string;
}

export interface CommittedFile {
    path: string;
    message: string;
    sha: string;
    html_url: string;
    phase: string;
    sourceAgent: string;
    timestamp: string;
}

// ── Config persistence ────────────────────────────────────────────────────────

export function loadRepoConfig(): RepoConfig | null {
    try {
        const raw = localStorage.getItem(REPO_CONFIG_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

export function saveRepoConfig(config: RepoConfig): void {
    try { localStorage.setItem(REPO_CONFIG_KEY, JSON.stringify(config)); } catch { }
}

// ── File writer — direct GitHub API ──────────────────────────────────────────

/**
 * Write or update a file in the configured GitHub repository.
 * Calls GitHub REST API directly — token stays in browser, zero backend needed.
 */
export async function writeFile(
    params: WriteFileParams,
    config?: RepoConfig,
): Promise<WriteFileResult> {
    const cfg = config ?? loadRepoConfig();
    if (!cfg?.token) throw new Error('No GitHub token configured. Connect GitHub in the Repo panel first.');
    if (!cfg.owner || !cfg.repo) throw new Error('No repository configured. Set owner and repo in the Repo panel.');

    const branch = cfg.branch || 'main';
    const apiBase = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${params.path}`;
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
    };

    // Fetch existing file SHA (required by GitHub for updates)
    let existingSha: string | undefined;
    try {
        const checkResp = await fetch(`${apiBase}?ref=${branch}`, { headers });
        if (checkResp.ok) {
            const existing = await checkResp.json() as { sha?: string };
            existingSha = existing.sha;
        }
    } catch { /* new file — no SHA needed */ }

    // Encode content as base64 (GitHub API requirement)
    const encoded = btoa(unescape(encodeURIComponent(params.content)));

    const body: Record<string, string> = {
        message: params.message,
        content: encoded,
        branch,
    };
    if (existingSha) body.sha = existingSha;

    const resp = await fetch(apiBase, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Unknown error');
        throw new Error(`GitHub API ${resp.status}: ${errText}`);
    }

    const data = await resp.json() as {
        content?: { sha?: string; html_url?: string; path?: string };
        commit?: { sha?: string };
    };

    return {
        committed: true,
        sha: data.content?.sha ?? data.commit?.sha ?? '',
        html_url: data.content?.html_url ?? `https://github.com/${cfg.owner}/${cfg.repo}/blob/${branch}/${params.path}`,
        path: data.content?.path ?? params.path,
    };
}

// ── Committed files log ───────────────────────────────────────────────────────

const LOG_KEY = 'nexus-committed-files';

export function loadCommittedFiles(): CommittedFile[] {
    try {
        const raw = localStorage.getItem(LOG_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function appendCommittedFile(file: CommittedFile): void {
    try {
        const existing = loadCommittedFiles();
        localStorage.setItem(LOG_KEY, JSON.stringify([file, ...existing]));
    } catch { }
}

export function clearCommittedFiles(): void {
    localStorage.removeItem(LOG_KEY);
}
