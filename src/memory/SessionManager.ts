/**
 * SessionManager.ts — Browser-safe persistent session store
 * NEXUS AI v6 — Persistent Memory System (§6 ARCHITECTURE.md)
 *
 * Strategy:
 *   Primary  → localStorage (instant, offline-capable)
 *   Secondary → Supabase DB (cross-device persistence, future)
 *
 * Atomic writes: JSON serialized atomically — no partial state.
 * Known Incomplete items are append-only (never deleted).
 */

export interface ModuleClassification {
    wired: string[];
    notWired: string[];
    test: string[];
    config: string[];
}

export interface SessionState {
    projectId?: string;
    veritas: {
        lastRun: string;
        exitCode: number;
        wired: number;
        notWired: number;
        total: number;
        criticalMissing: string[];
        history: VeritasHistoryEntry[];
    };
    moduleClassification: ModuleClassification;
    knownIncomplete: KnownIncompleteEntry[];
    currentPhase: string | null;
    approvedPhases: string[];
}

export interface VeritasHistoryEntry {
    timestamp: string;
    exitCode: number;
    wired: number;
    total: number;
}

export interface KnownIncompleteEntry {
    id: string;
    item: string;
    state: 'DISABLED' | 'BUGGY' | 'UNVERIFIED' | 'PARTIAL' | 'RESOLVED';
    impact: string;
    phase: string;
    addedAt: string;
    resolvedAt?: string;
    resolutionEvidence?: string;
}

const SESSION_KEY = 'nexus-session-state';

const DEFAULT_STATE: SessionState = {
    veritas: {
        lastRun: '',
        exitCode: -1,
        wired: 0,
        notWired: 0,
        total: 0,
        criticalMissing: [],
        history: [],
    },
    moduleClassification: { wired: [], notWired: [], test: [], config: [] },
    knownIncomplete: [],
    currentPhase: null,
    approvedPhases: [],
};

export class SessionManager {
    /**
     * Read current session state from localStorage.
     * Returns null if no session exists yet.
     */
    public getSession(): SessionState | null {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? (JSON.parse(raw) as SessionState) : null;
        } catch {
            return null;
        }
    }

    /**
     * Persist session state atomically.
     * Replaces the full state object (merge is caller responsibility).
     */
    public writeSession(state: SessionState): void {
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(state));
            console.info('[SessionManager] Session persisted.', {
                phase: state.currentPhase,
                veritasExitCode: state.veritas.exitCode,
            });
        } catch (err) {
            console.error('[SessionManager] Failed to persist session:', err);
        }
    }

    /**
     * Append a Known Incomplete item to the session.
     * Items are NEVER deleted — only resolved with evidence.
     * Implements ARCHITECTURE.md Rule #10: Known Incomplete append-only.
     */
    public appendKnownIncomplete(item: Omit<KnownIncompleteEntry, 'id' | 'addedAt'>): KnownIncompleteEntry {
        const session = this.getSession() ?? { ...DEFAULT_STATE };
        const entry: KnownIncompleteEntry = {
            ...item,
            id: `KI-${Date.now()}`,
            addedAt: new Date().toISOString(),
        };
        session.knownIncomplete.push(entry);
        this.writeSession(session);
        console.info('[SessionManager] Known Incomplete item appended:', entry.id);
        return entry;
    }

    /**
     * Mark a Known Incomplete item as RESOLVED.
     * Evidence string is mandatory — cannot resolve without proof.
     */
    public resolveKnownIncomplete(id: string, evidence: string): void {
        const session = this.getSession();
        if (!session) return;
        session.knownIncomplete = session.knownIncomplete.map(item =>
            item.id === id
                ? { ...item, state: 'RESOLVED' as const, resolvedAt: new Date().toISOString(), resolutionEvidence: evidence }
                : item
        );
        this.writeSession(session);
        console.info('[SessionManager] Known Incomplete resolved:', id);
    }

    /**
     * Update Veritas status in the session after each run.
     */
    public updateVeritas(exitCode: number, wired: number, total: number, criticalMissing: string[]): void {
        const session = this.getSession() ?? { ...DEFAULT_STATE };
        const entry: VeritasHistoryEntry = {
            timestamp: new Date().toISOString(),
            exitCode,
            wired,
            total,
        };
        session.veritas = {
            ...session.veritas,
            lastRun: entry.timestamp,
            exitCode,
            wired,
            notWired: total - wired,
            total,
            criticalMissing,
            history: [...session.veritas.history, entry],
        };
        this.writeSession(session);
    }

    /**
     * Reset session to default state (new project).
     */
    public reset(): void {
        localStorage.removeItem(SESSION_KEY);
        console.info('[SessionManager] Session reset.');
    }
}
