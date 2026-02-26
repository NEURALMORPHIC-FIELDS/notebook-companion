/**
 * FileWriterService.ts — Browser client for file-writer edge function
 * NEXUS AI v6 — Sprint B
 *
 * Calls the file-writer Supabase Edge Function with file content
 * and returns commit SHA + GitHub URL.
 */

const WRITER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/file-writer`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const REPO_CONFIG_KEY = 'nexus-repo-config';

export interface RepoConfig {
    owner: string;
    repo: string;
    branch: string;
    token: string;  // GitHub PAT — stored in localStorage, never sent to Supabase backend as a secret
}

export interface WriteFileParams {
    path: string;        // e.g. "src/components/Foo.tsx"
    content: string;     // raw text content
    message: string;     // commit message
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

// ── File writer ───────────────────────────────────────────────────────────────

/**
 * Write or update a file in the configured GitHub repository.
 * Throws on network error or HTTP error.
 */
export async function writeFile(
    params: WriteFileParams,
    config?: RepoConfig,
): Promise<WriteFileResult> {
    const cfg = config ?? loadRepoConfig();
    if (!cfg) throw new Error('No repository configured. Set owner/repo/branch/token in the Repo panel.');

    const resp = await fetch(WRITER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
            owner: cfg.owner,
            repo: cfg.repo,
            branch: cfg.branch,
            token: cfg.token,
            path: params.path,
            content: params.content,
            message: params.message,
        }),
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Unknown error');
        throw new Error(`file-writer HTTP ${resp.status}: ${errText}`);
    }

    return resp.json() as Promise<WriteFileResult>;
}

// ── Committed files log (localStorage) ───────────────────────────────────────

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
