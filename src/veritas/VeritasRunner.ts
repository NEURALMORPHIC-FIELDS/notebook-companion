/**
 * VeritasRunner.ts — Browser-safe Veritas Ground Truth executor
 * NEXUS AI v6 — Veritas Ground Truth System (§2 ARCHITECTURE.md)
 *
 * Calls the `veritas-runner` Supabase Edge Function which performs
 * the actual module wiring analysis server-side (no Python required
 * in the browser). The result is cached in localStorage for SanityGate.
 *
 * Exit codes (per ARCHITECTURE.md §2.1):
 *   0 = All CRITICAL_MODULES are WIRED — Sanity Gate opens
 *   1 = One or more CRITICAL_MODULES are NOT_WIRED — Sanity Gate blocks
 */

export interface VeritasReport {
    total: number;
    wired: number;
    not_wired: number;
    critical_missing: string[];
    test_modules: string[];
    config_modules: string[];
    exit_code: 0 | 1 | 2;
    timestamp?: string;
}

const VERITAS_REPORT_KEY = 'nexus-veritas-report';
const VERITAS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/veritas-runner`;

export class VeritasRunner {
    /**
     * Execute Veritas analysis via the edge function.
     * Stores result in localStorage for SanityGate and SemanticStateTracker.
     *
     * @param criticalModules List of module paths that must be WIRED (from FAS + Tech Spec)
     * @param verbose Include full module classification in response
     * @returns Exit code: 0 (all wired) | 1 (missing critical modules)
     */
    public async runVeritas(criticalModules: string[] = [], verbose = false): Promise<number> {
        console.info('[VeritasRunner] Executing Veritas check...', {
            criticalModuleCount: criticalModules.length,
            verbose,
        });

        try {
            const resp = await fetch(VERITAS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: JSON.stringify({ criticalModules, verbose }),
                signal: AbortSignal.timeout(30_000),
            });

            if (!resp.ok) {
                const errText = await resp.text().catch(() => 'Unknown error');
                console.error(`[VeritasRunner] Edge function error ${resp.status}: ${errText}`);
                return 1;
            }

            const data = await resp.json();
            const report: VeritasReport = {
                ...data.report,
                timestamp: new Date().toISOString(),
            };

            // Persist for SanityGate + SemanticStateTracker
            VeritasRunner.saveReport(report);

            console.info('[VeritasRunner] Veritas complete.', {
                exitCode: report.exit_code,
                wired: `${report.wired}/${report.total}`,
                criticalMissing: report.critical_missing.length,
            });

            return report.exit_code;
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.error('[VeritasRunner] Timeout: edge function did not respond within 30s.');
            } else {
                console.error('[VeritasRunner] Error:', err);
            }
            return 1;
        }
    }

    /**
     * Persist Veritas report to localStorage.
     * Called by VeritasRunner after each run.
     * Also callable by tests to inject a synthetic report.
     */
    public static saveReport(report: VeritasReport): void {
        localStorage.setItem(VERITAS_REPORT_KEY, JSON.stringify(report));
    }

    /**
     * Read the last Veritas report from localStorage.
     * Returns null if no report has been generated yet.
     */
    public static loadReport(): VeritasReport | null {
        const raw = localStorage.getItem(VERITAS_REPORT_KEY);
        return raw ? (JSON.parse(raw) as VeritasReport) : null;
    }
}
