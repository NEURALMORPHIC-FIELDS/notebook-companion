/**
 * SemanticStateTracker.ts — Module state classifier
 * NEXUS AI v6 — Veritas Ground Truth System (§2.1 ARCHITECTURE.md)
 *
 * Reads the last Veritas report and classifies any module into one of:
 *   WIRED     — in transitive import graph of entry point
 *   NOT_WIRED — exists on disk but unreachable from entry point
 *   TEST      — path contains 'test', lives under tests/ or filename has test_
 *   CONFIG    — in SKIP_FILES (__init__, conftest, setup) or path contains 'config'
 *
 * Browser-safe: reads from localStorage (written by VeritasRunner).
 * No fs, no path, no Node.js dependencies.
 */

import { VeritasRunner } from './VeritasRunner';

export type ModuleCategory = 'WIRED' | 'NOT_WIRED' | 'TEST' | 'CONFIG' | 'UNKNOWN';

export interface ModuleState {
    path: string;
    category: ModuleCategory;
    isCritical: boolean;
}

export class SemanticStateTracker {
    /**
     * Classify a single module by its import path.
     * Returns 'UNKNOWN' if no Veritas report exists yet.
     */
    public getModuleCategory(moduleImportPath: string): ModuleCategory {
        const report = VeritasRunner.loadReport();
        if (!report) return 'UNKNOWN';

        // Check classification lists from the Veritas report
        if (report.critical_missing?.includes(moduleImportPath)) return 'NOT_WIRED';
        if (report.test_modules?.includes(moduleImportPath)) return 'TEST';
        if (report.config_modules?.includes(moduleImportPath)) return 'CONFIG';

        // If report exists and module is not in any "missing" list, it's WIRED
        return 'WIRED';
    }

    /**
     * Returns a full snapshot of all classified modules.
     * Used by ModuleStateMatrix UI component.
     */
    public getAllModuleStates(): ModuleState[] {
        const report = VeritasRunner.loadReport();
        if (!report) return [];

        const states: ModuleState[] = [];

        (report.critical_missing || []).forEach(path => {
            states.push({ path, category: 'NOT_WIRED', isCritical: true });
        });

        (report.test_modules || []).forEach(path => {
            states.push({ path, category: 'TEST', isCritical: false });
        });

        (report.config_modules || []).forEach(path => {
            states.push({ path, category: 'CONFIG', isCritical: false });
        });

        return states;
    }

    /**
     * Returns summary counts per category.
     * Used by VeritasDashboard and HITL panel header.
     */
    public getSummary(): Record<ModuleCategory, number> {
        const report = VeritasRunner.loadReport();
        if (!report) {
            return { WIRED: 0, NOT_WIRED: 0, TEST: 0, CONFIG: 0, UNKNOWN: 0 };
        }
        return {
            WIRED: report.wired,
            NOT_WIRED: report.not_wired,
            TEST: (report.test_modules || []).length,
            CONFIG: (report.config_modules || []).length,
            UNKNOWN: 0,
        };
    }
}
