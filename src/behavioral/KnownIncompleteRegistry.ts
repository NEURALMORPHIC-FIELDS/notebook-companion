/**
 * KnownIncompleteRegistry.ts — append-only Known Incomplete item registry
 * NEXUS AI v6 — Behavioral Rule #10 (§3 ARCHITECTURE.md)
 *
 * ARCHITECTURE.md Rule #10:
 *   "Known Incomplete — mandatory section in every report.
 *    Cannot be empty if Veritas exit_code != 0.
 *    First visible element in HITL panel."
 *
 * Append-only: items are NEVER deleted.
 * Items may be RESOLVED but only with mandatory evidence (proof).
 * Veritas detects discrepancy between resolved items and exit_code → alert.
 *
 * Persistence: localStorage key 'nexus-known-incomplete'
 */

export type IncompleteState = 'DISABLED' | 'BUGGY' | 'UNVERIFIED' | 'PARTIAL' | 'RESOLVED';

export interface KnownIncompleteItem {
    id: string;                   // KI-{timestamp}
    item: string;                 // Description of what is incomplete
    state: IncompleteState;
    impact: string;               // Business/technical impact
    phase: string;                // SDLC phase where it was discovered
    affectedFunction?: string;    // FAS function ID (e.g. "F-003")
    addedAt: string;              // ISO timestamp
    resolvedAt?: string;          // ISO timestamp — only when state = RESOLVED
    resolutionEvidence?: string;  // MANDATORY when state = RESOLVED — proof it works
}

const STORAGE_KEY = 'nexus-known-incomplete';

export class KnownIncompleteRegistry {
    /**
     * Append a new Known Incomplete item. Returns the created item with its ID.
     * Items are append-only — this is the ONLY way to add items.
     *
     * ARCHITECTURE.md: Cannot be empty if Veritas exit_code != 0.
     */
    public append(item: Omit<KnownIncompleteItem, 'id' | 'addedAt'>): KnownIncompleteItem {
        const registry = this.getAll();
        const entry: KnownIncompleteItem = {
            ...item,
            id: `KI-${Date.now()}`,
            addedAt: new Date().toISOString(),
        };
        registry.push(entry);
        this.persist(registry);
        console.info('[KnownIncomplete] Item appended:', entry.id, entry.item);
        return entry;
    }

    /**
     * Mark a Known Incomplete item as RESOLVED.
     * Evidence is MANDATORY — resolving without proof is not allowed.
     * The original item is preserved (append-only history).
     */
    public resolve(id: string, evidence: string): void {
        if (!evidence || evidence.trim() === '') {
            console.error('[KnownIncomplete] Resolution rejected: evidence is mandatory.');
            throw new Error('Resolution evidence is mandatory. Cannot resolve without proof.');
        }
        const registry = this.getAll().map(item =>
            item.id === id
                ? {
                    ...item,
                    state: 'RESOLVED' as IncompleteState,
                    resolvedAt: new Date().toISOString(),
                    resolutionEvidence: evidence,
                }
                : item
        );
        this.persist(registry);
        console.info('[KnownIncomplete] Item resolved:', id);
    }

    /**
     * Get all items including resolved ones.
     * Use this for audit / history views.
     */
    public getAll(): KnownIncompleteItem[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? (JSON.parse(raw) as KnownIncompleteItem[]) : [];
        } catch {
            return [];
        }
    }

    /**
     * Get only unresolved items.
     * Used by HITL panel (first visible section) and Veritas discrepancy check.
     */
    public getUnresolved(): KnownIncompleteItem[] {
        return this.getAll().filter(i => i.state !== 'RESOLVED');
    }

    /**
     * Validate consistency: if Veritas exit_code != 0, unresolved list cannot be empty.
     * ARCHITECTURE.md: "Veritas detects discrepancy → alert."
     *
     * @param veritasExitCode Current Veritas exit code
     * @returns true if consistent, false if discrepancy detected (ALERT condition)
     */
    public validateConsistency(veritasExitCode: number): boolean {
        if (veritasExitCode !== 0 && this.getUnresolved().length === 0) {
            console.error(
                '[KnownIncomplete] DISCREPANCY: Veritas exit_code != 0 but Known Incomplete is empty. ' +
                'Agent is reporting progress without documenting what is broken.'
            );
            return false;
        }
        return true;
    }

    /**
     * Count items by state for dashboard display.
     */
    public getSummary(): Record<IncompleteState, number> {
        const all = this.getAll();
        return {
            DISABLED: all.filter(i => i.state === 'DISABLED').length,
            BUGGY: all.filter(i => i.state === 'BUGGY').length,
            UNVERIFIED: all.filter(i => i.state === 'UNVERIFIED').length,
            PARTIAL: all.filter(i => i.state === 'PARTIAL').length,
            RESOLVED: all.filter(i => i.state === 'RESOLVED').length,
        };
    }

    /** Clear all items — only for tests. Production code must NOT call this. */
    public _resetForTesting(): void {
        localStorage.removeItem(STORAGE_KEY);
    }

    private persist(registry: KnownIncompleteItem[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    }
}

// Singleton for use across the application
export const knownIncompleteRegistry = new KnownIncompleteRegistry();
