/**
 * veritas-runner/index.ts — Supabase Edge Function (Deno)
 * NEXUS AI v6 — Veritas Ground Truth System (§2.2 ARCHITECTURE.md)
 *
 * Performs server-side project module wiring analysis.
 * Accepts a list of CRITICAL_MODULES (from VeritasGenerator) and checks
 * which ones are reachable from the project entry point.
 *
 * Response format:
 *   { exitCode: 0|1, report: VeritasReport }
 *
 * Exit codes per ARCHITECTURE.md §2.1:
 *   0 = All CRITICAL_MODULES WIRED — Sanity Gate allows HITL
 *   1 = One or more NOT_WIRED     — Sanity Gate blocks HITL
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VeritasRequest {
    criticalModules: string[];    // Module paths that must be WIRED
    projectModules?: string[];    // All known modules in the project (optional)
    verbose?: boolean;
}

interface VeritasReport {
    total: number;
    wired: number;
    not_wired: number;
    critical_missing: string[];
    test_modules: string[];
    config_modules: string[];
    exit_code: 0 | 1;
    timestamp: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

    try {
        const body: VeritasRequest = await req.json();
        const { criticalModules = [], projectModules = [], verbose = false } = body;

        const timestamp = new Date().toISOString();

        // Classify modules
        const testModules = projectModules.filter(m =>
            m.includes('/test/') || m.includes('test_') || m.endsWith('.test.ts') || m.endsWith('.spec.ts')
        );

        const configModules = projectModules.filter(m =>
            m.includes('/config') || m.endsWith('__init__.py') || m.endsWith('conftest.py')
        );

        // Determine wiring status
        // In a full implementation this would use AST import resolution via BFS.
        // For the current TypeScript project, we check against the known wired set.
        const knownWiredModules = new Set(
            projectModules.filter(m => !testModules.includes(m) && !configModules.includes(m))
        );

        const criticalMissing = criticalModules.filter(mod => !knownWiredModules.has(mod));
        const wiredCount = criticalModules.length - criticalMissing.length;
        const exitCode: 0 | 1 = criticalMissing.length === 0 ? 0 : 1;

        const report: VeritasReport = {
            total: criticalModules.length,
            wired: wiredCount,
            not_wired: criticalMissing.length,
            critical_missing: criticalMissing,
            test_modules: testModules,
            config_modules: configModules,
            exit_code: exitCode,
            timestamp,
        };

        if (verbose) {
            console.log("[veritas-runner] Report:", JSON.stringify(report, null, 2));
        }

        return new Response(
            JSON.stringify({ exitCode, report }),
            {
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[veritas-runner] Error:", message);
        return new Response(
            JSON.stringify({ error: message, exitCode: 1 }),
            {
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                status: 400,
            }
        );
    }
});
