/**
 * DeployService.ts — Browser client for deploy-trigger edge function
 * NEXUS AI v6 — Sprint E
 */

const DEPLOY_TRIGGER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-trigger`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const DEPLOY_CONFIG_KEY = 'nexus-deploy-config';
const DEPLOY_LOG_KEY = 'nexus-deploy-log';

export type DeployProvider = 'netlify' | 'vercel';

export interface DeployConfig {
    provider: DeployProvider;
    hook_url: string;
}

export interface DeployResult {
    triggered: true;
    provider: DeployProvider;
    timestamp: string;
}

export interface DeployLogEntry {
    provider: DeployProvider;
    timestamp: string;
    triggeredBy: string;  // phase or 'manual'
    status: 'success' | 'error';
    error?: string;
}

// ── Config persistence ────────────────────────────────────────────────────────

export function loadDeployConfig(): DeployConfig | null {
    try {
        const raw = localStorage.getItem(DEPLOY_CONFIG_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

export function saveDeployConfig(config: DeployConfig): void {
    try {
        localStorage.setItem(DEPLOY_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
        console.warn('[DeployService] Failed to persist deploy config.', error);
    }
}

// ── Deploy log ────────────────────────────────────────────────────────────────

export function loadDeployLog(): DeployLogEntry[] {
    try {
        const raw = localStorage.getItem(DEPLOY_LOG_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function appendDeployLog(entry: DeployLogEntry): void {
    try {
        const existing = loadDeployLog();
        localStorage.setItem(DEPLOY_LOG_KEY, JSON.stringify([entry, ...existing].slice(0, 50)));
    } catch (error) {
        console.warn('[DeployService] Failed to persist deploy log entry.', error);
    }
}

export function clearDeployLog(): void {
    localStorage.removeItem(DEPLOY_LOG_KEY);
}

// ── Trigger ───────────────────────────────────────────────────────────────────

/**
 * Triggers a deploy via the deploy-trigger Supabase edge function.
 * Throws on network/HTTP error.
 */
export async function triggerDeploy(
    provider: DeployProvider,
    hookUrl: string,
    triggeredBy = 'manual',
): Promise<DeployResult> {
    const resp = await fetch(DEPLOY_TRIGGER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ provider, hook_url: hookUrl }),
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Unknown error');
        const err = `deploy-trigger HTTP ${resp.status}: ${errText}`;
        appendDeployLog({ provider, timestamp: new Date().toISOString(), triggeredBy, status: 'error', error: err });
        throw new Error(err);
    }

    const result = await resp.json() as DeployResult;
    appendDeployLog({ provider, timestamp: result.timestamp, triggeredBy, status: 'success' });
    return result;
}
