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

type ModuleCategory = "WIRED" | "NOT_WIRED" | "TEST" | "CONFIG";

interface VeritasModule {
    name: string;
    path: string;
    category: ModuleCategory;
    isCritical: boolean;
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

function normalizePath(input: string): string {
    return input.replace(/\\/g, "/").replace(/^\/+/, "");
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
        const normalizedProjectModules = [...new Set(projectModules.map(normalizePath).filter(Boolean))];
        const normalizedCriticalModules = [...new Set(criticalModules.map(normalizePath).filter(Boolean))];

        const projectSet = new Set(normalizedProjectModules);
        const criticalSet = new Set(normalizedCriticalModules);

        const modules: VeritasModule[] = [];

        normalizedProjectModules.forEach((path) => {
            const isTestModule =
                path.includes("/test/")
                || path.includes("/tests/")
                || path.includes("test_")
                || path.endsWith(".test.ts")
                || path.endsWith(".spec.ts");

            const isConfigModule =
                path.includes("/config")
                || path.endsWith("__init__.py")
                || path.endsWith("conftest.py");

            const isCritical = criticalSet.has(path);

            let category: ModuleCategory = "WIRED";
            if (isTestModule) {
                category = "TEST";
            } else if (isConfigModule) {
                category = "CONFIG";
            }

            modules.push({
                name: path.replace(/\.[^.]+$/, "").replace(/\//g, "."),
                path,
                category,
                isCritical,
            });
        });

        normalizedCriticalModules
            .filter((criticalPath) => !projectSet.has(criticalPath))
            .forEach((missingPath) => {
                modules.push({
                    name: missingPath.replace(/\.[^.]+$/, "").replace(/\//g, "."),
                    path: missingPath,
                    category: "NOT_WIRED",
                    isCritical: true,
                });
            });

        modules.sort((left, right) => {
            const rank: Record<ModuleCategory, number> = {
                NOT_WIRED: 0,
                WIRED: 1,
                TEST: 2,
                CONFIG: 3,
            };
            const categoryDiff = rank[left.category] - rank[right.category];
            if (categoryDiff !== 0) {
                return categoryDiff;
            }
            if (left.isCritical !== right.isCritical) {
                return left.isCritical ? -1 : 1;
            }
            return left.path.localeCompare(right.path);
        });

        const testModules = modules.filter((module) => module.category === "TEST").map((module) => module.path);
        const configModules = modules.filter((module) => module.category === "CONFIG").map((module) => module.path);
        const criticalMissing = modules
            .filter((module) => module.category === "NOT_WIRED" && module.isCritical)
            .map((module) => module.path);
        const wiredCount = modules.filter((module) => module.category === "WIRED").length;
        const notWiredCount = modules.filter((module) => module.category === "NOT_WIRED").length;
        const exitCode: 0 | 1 = criticalMissing.length > 0 ? 1 : 0;

        const report: VeritasReport = {
            total: modules.length,
            wired: wiredCount,
            not_wired: notWiredCount,
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
            JSON.stringify({ exitCode, report, modules }),
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
