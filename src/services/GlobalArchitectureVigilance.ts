/**
 * GlobalArchitectureVigilance.ts — persistent global structural guard
 * NEXUS AI v6
 *
 * Goal:
 * - Persist structural snapshots for every phase output.
 * - Detect upstream changes and mark downstream phases as stale.
 * - Enforce minimal structural contracts for key phases.
 * - Validate phase/file-path alignment before repository commits.
 */

export type VigilanceAlertType =
    | 'UPSTREAM_CHANGED'
    | 'STRUCTURE_MISMATCH'
    | 'ROLE_DOMAIN_CONFLICT';

export type VigilanceSeverity = 'HIGH' | 'MEDIUM';

export interface StructuralSummary {
    chars: number;
    lines: number;
    codeBlocks: number;
    headings: number;
    listItems: number;
    openMentions: number;
    closeMentions: number;
}

export interface StructuralSnapshot {
    phase: string;
    agentRole: string;
    hash: string;
    summary: StructuralSummary;
    recordedAt: string;
}

export interface VigilanceAlert {
    id: string;
    type: VigilanceAlertType;
    severity: VigilanceSeverity;
    phase: string;
    message: string;
    relatedPhases?: string[];
    createdAt: string;
    resolved: boolean;
}

export interface GlobalVigilanceState {
    snapshots: Record<string, StructuralSnapshot>;
    stalePhases: string[];
    alerts: VigilanceAlert[];
    lastUpdated: string;
}

export interface VigilanceResult {
    state: GlobalVigilanceState;
    changed: boolean;
    stalePhases: string[];
    alerts: VigilanceAlert[];
    blocked: boolean;
}

export interface PathValidationResult {
    allowed: boolean;
    state: GlobalVigilanceState;
    alert?: VigilanceAlert;
}

const STORAGE_KEY = 'nexus-global-vigilance-state';

const PHASE_CHAIN = ['1A', '1B', '2', '3A', '3B', '4', '5', '6A', '6B', '7', '8', '9', '10', '11'];

const PHASE_REQUIRED_PREFIX: Record<string, string> = {
    '1A': 'docs/',
    '1B': 'docs/',
    '2': 'docs/',
    '3A': 'docs/',
    '3B': 'docs/',
    '4': 'docs/',
    '5': 'docs/',
    '6A': 'src/',
    '6B': 'assets/',
    '7': 'docs/',
    '8': 'docs/',
    '9': 'docs/',
    '10': 'docs/',
    '11': 'devops/',
};

const PHASE_MIN_CHARS: Record<string, number> = {
    '1A': 180,
    '3A': 140,
    '4': 140,
    '5': 120,
    '6A': 120,
    '7': 120,
    '8': 120,
    '9': 120,
    '10': 120,
    '11': 120,
};

const EMPTY_STATE: GlobalVigilanceState = {
    snapshots: {},
    stalePhases: [],
    alerts: [],
    lastUpdated: new Date(0).toISOString(),
};

export class GlobalArchitectureVigilance {
    private state: GlobalVigilanceState;

    constructor() {
        this.state = this.loadState();
    }

    public getState(): GlobalVigilanceState {
        return JSON.parse(JSON.stringify(this.state)) as GlobalVigilanceState;
    }

    public recordPhaseOutput(phase: string, agentRole: string, content: string): VigilanceResult {
        const now = new Date().toISOString();
        const summary = this.buildSummary(content);
        const snapshot: StructuralSnapshot = {
            phase,
            agentRole,
            hash: this.hashContent(content),
            summary,
            recordedAt: now,
        };

        const previous = this.state.snapshots[phase];
        const changed = Boolean(previous && previous.hash !== snapshot.hash);

        this.state.snapshots[phase] = snapshot;

        const staleSet = new Set(this.state.stalePhases);
        staleSet.delete(phase);

        const alerts: VigilanceAlert[] = [];

        if (changed) {
            const downstream = this.getDownstreamPhases(phase);
            downstream.forEach(p => staleSet.add(p));
            if (downstream.length > 0) {
                const alert = this.createAlert(
                    'UPSTREAM_CHANGED',
                    'MEDIUM',
                    phase,
                    `Phase ${phase} output changed. Downstream phases must be regenerated.`,
                    downstream,
                );
                alerts.push(alert);
                this.appendAlert(alert);
            }
        }

        const structuralAlerts = this.validateStructure(phase, content, summary);
        structuralAlerts.forEach(a => {
            alerts.push(a);
            this.appendAlert(a);
        });

        this.state.stalePhases = [...staleSet].sort(
            (a, b) => PHASE_CHAIN.indexOf(a) - PHASE_CHAIN.indexOf(b)
        );
        this.state.lastUpdated = now;
        this.persistState();

        return {
            state: this.getState(),
            changed,
            stalePhases: [...this.state.stalePhases],
            alerts,
            blocked: structuralAlerts.some(a => a.severity === 'HIGH'),
        };
    }

    public validatePhaseFilePath(phase: string, filePath: string): PathValidationResult {
        const requiredPrefix = PHASE_REQUIRED_PREFIX[phase] ?? 'output/';
        if (filePath.startsWith(requiredPrefix)) {
            return { allowed: true, state: this.getState() };
        }

        const alert = this.createAlert(
            'ROLE_DOMAIN_CONFLICT',
            'HIGH',
            phase,
            `Phase ${phase} attempted to write "${filePath}" outside required structural domain "${requiredPrefix}".`,
        );
        this.appendAlert(alert);
        this.state.lastUpdated = new Date().toISOString();
        this.persistState();
        return { allowed: false, state: this.getState(), alert };
    }

    public isPhaseStale(phase: string): boolean {
        return this.state.stalePhases.includes(phase);
    }

    public getPhaseAlerts(phase: string): VigilanceAlert[] {
        return this.state.alerts.filter(a => a.phase === phase && !a.resolved);
    }

    public clear(): void {
        this.state = JSON.parse(JSON.stringify(EMPTY_STATE)) as GlobalVigilanceState;
        this.persistState();
    }

    private validateStructure(phase: string, content: string, summary: StructuralSummary): VigilanceAlert[] {
        const alerts: VigilanceAlert[] = [];
        const minChars = PHASE_MIN_CHARS[phase] ?? 80;
        if (summary.chars < minChars) {
            alerts.push(this.createAlert(
                'STRUCTURE_MISMATCH',
                phase === '6A' || phase === '1A' ? 'HIGH' : 'MEDIUM',
                phase,
                `Phase ${phase} output is too short (${summary.chars} chars, expected >= ${minChars}).`,
            ));
        }

        if (phase === '1A') {
            const hasFunctionTags = /F-\d+/i.test(content);
            if (!hasFunctionTags) {
                alerts.push(this.createAlert(
                    'STRUCTURE_MISMATCH',
                    'HIGH',
                    phase,
                    'Phase 1A must declare function IDs (F-XXX).',
                ));
            }
            if (summary.openMentions === 0 || summary.closeMentions === 0) {
                alerts.push(this.createAlert(
                    'STRUCTURE_MISMATCH',
                    'HIGH',
                    phase,
                    'Phase 1A must define OPEN/CLOSE semantics for architectural state transitions.',
                ));
            }
        }

        if (phase === '6A' && summary.codeBlocks === 0) {
            alerts.push(this.createAlert(
                'STRUCTURE_MISMATCH',
                'HIGH',
                phase,
                'Phase 6A must contain at least one fenced code block.',
            ));
        }

        if (phase === '5' && !/T-\d+/i.test(content)) {
            alerts.push(this.createAlert(
                'STRUCTURE_MISMATCH',
                'MEDIUM',
                phase,
                'Phase 5 should include task IDs (T-XXX) for WBS traceability.',
            ));
        }

        return alerts;
    }

    private appendAlert(alert: VigilanceAlert): void {
        const duplicate = this.state.alerts.find(a =>
            !a.resolved &&
            a.type === alert.type &&
            a.phase === alert.phase &&
            a.message === alert.message
        );
        if (!duplicate) {
            this.state.alerts.push(alert);
        }
    }

    private buildSummary(content: string): StructuralSummary {
        const lines = content.split('\n');
        const codeBlocks = (content.match(/```/g) || []).length / 2;
        const headings = (content.match(/^#{1,6}\s+/gm) || []).length;
        const listItems = (content.match(/^[-*]\s+/gm) || []).length;
        const openMentions = (content.match(/\bOPEN\b/gi) || []).length;
        const closeMentions = (content.match(/\bCLOSE\b/gi) || []).length;

        return {
            chars: content.length,
            lines: lines.length,
            codeBlocks,
            headings,
            listItems,
            openMentions,
            closeMentions,
        };
    }

    private createAlert(
        type: VigilanceAlertType,
        severity: VigilanceSeverity,
        phase: string,
        message: string,
        relatedPhases?: string[],
    ): VigilanceAlert {
        return {
            id: `gv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            severity,
            phase,
            message,
            relatedPhases,
            createdAt: new Date().toISOString(),
            resolved: false,
        };
    }

    private getDownstreamPhases(phase: string): string[] {
        const idx = PHASE_CHAIN.indexOf(phase);
        if (idx < 0 || idx === PHASE_CHAIN.length - 1) return [];
        return PHASE_CHAIN.slice(idx + 1);
    }

    private hashContent(content: string): string {
        let hash = 2166136261;
        for (let i = 0; i < content.length; i++) {
            hash ^= content.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return `fnv1a-${(hash >>> 0).toString(16)}`;
    }

    private loadState(): GlobalVigilanceState {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(EMPTY_STATE)) as GlobalVigilanceState;
            const parsed = JSON.parse(raw) as Partial<GlobalVigilanceState>;
            return {
                snapshots: parsed.snapshots ?? {},
                stalePhases: parsed.stalePhases ?? [],
                alerts: parsed.alerts ?? [],
                lastUpdated: parsed.lastUpdated ?? new Date(0).toISOString(),
            };
        } catch {
            return JSON.parse(JSON.stringify(EMPTY_STATE)) as GlobalVigilanceState;
        }
    }

    private persistState(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch {
            // Storage quota errors are non-fatal for runtime behavior.
        }
    }
}

export const globalArchitectureVigilance = new GlobalArchitectureVigilance();
