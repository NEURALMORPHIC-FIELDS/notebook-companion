/**
 * VeritasGenerator.ts — generate CRITICAL_MODULES list from FAS + Tech Spec
 * NEXUS AI v6 — Veritas Ground Truth System (§2.2 ARCHITECTURE.md)
 *
 * "VeritasGenerator generates verify_project.py specifically adapted to the
 * project, from FAS + Tech Spec + WBS. It is not a generic script — it knows
 * exactly which modules must exist, be wired, and be active for that specific
 * project." — ARCHITECTURE.md §2.2
 *
 * In the TypeScript/Lovable context, VeritasGenerator produces the list of
 * critical module paths that is sent to the veritas-runner edge function.
 */

import { VeritasRunner } from './VeritasRunner';

// ── FAS Types ────────────────────────────────────────────────────────────────

export interface FASFunction {
    id: string;           // e.g. "F-001"
    name: string;
    effectType: 'OPEN' | 'CLOSE' | 'NEUTRAL';
    requiredServices: string[];       // Abstract service names
    priority: 'critical' | 'high' | 'medium' | 'low';
    closePairId?: string;
    verificationMechanism?: string;
}

export interface FASDocument {
    projectId: string;
    functions: FASFunction[];
    aggregatedServices: string[];
    approvedAt?: string;
}

export interface TechSpec {
    projectId: string;
    components: TechSpecComponent[];
}

export interface TechSpecComponent {
    name: string;
    modulePath: string;        // e.g. "src/agents/ProjectManagerAgent.ts"
    isCritical: boolean;
    fasService?: string;       // Corresponding FAS required_service
}

// ── Generator ────────────────────────────────────────────────────────────────

export class VeritasGenerator {
    /**
     * Derive the list of CRITICAL_MODULES from the approved FAS and Tech Spec.
     * Every module that implements a critical FAS service is in the list.
     *
     * ARCHITECTURE.md §2.2: "Every path here maps to a function in FAS that
     * cannot work without it."
     */
    public generateCriticalModules(fas: FASDocument, techSpec: TechSpec): string[] {
        // Collect all services required by critical FAS functions
        const criticalServices = new Set<string>();
        for (const fn of fas.functions) {
            if (fn.priority === 'critical') {
                fn.requiredServices.forEach(svc => criticalServices.add(svc));
            }
        }

        // Map services to module paths via Tech Spec
        const criticalModules = new Set<string>();
        for (const component of techSpec.components) {
            if (component.isCritical || (component.fasService && criticalServices.has(component.fasService))) {
                criticalModules.add(component.modulePath);
            }
        }

        console.info('[VeritasGenerator] Critical modules derived:', {
            criticalServices: criticalServices.size,
            criticalModules: criticalModules.size,
        });

        return [...criticalModules];
    }

    /**
     * Generate critical modules AND immediately run a Veritas check.
     * Stores the report in localStorage (available to SanityGate immediately).
     *
     * @returns Veritas exit code: 0 (all wired) | 1 (missing critical modules)
     */
    public async generateAndRunVeritas(
        fas: FASDocument,
        techSpec: TechSpec,
        allProjectModules: string[] = [],
    ): Promise<number> {
        const criticalModules = this.generateCriticalModules(fas, techSpec);
        const runner = new VeritasRunner();
        const exitCode = await runner.runVeritas(criticalModules);

        console.info('[VeritasGenerator] Veritas run complete.', { exitCode, criticalModules });
        return exitCode;
    }

    /**
     * Serialize FAS to a human-readable Markdown summary.
     * Used by PM Agent when generating NEXUS.md.
     */
    public fasToMarkdown(fas: FASDocument): string {
        const lines: string[] = [
            `# FAS — ${fas.projectId}`,
            `**Approved:** ${fas.approvedAt ?? 'pending'}`,
            '',
            '## Functions',
        ];

        for (const fn of fas.functions) {
            lines.push(`\n### ${fn.id} — ${fn.name}`);
            lines.push(`- **Effect:** ${fn.effectType}`);
            lines.push(`- **Priority:** ${fn.priority}`);
            lines.push(`- **Required Services:** ${fn.requiredServices.join(', ') || 'none'}`);
            if (fn.closePairId) lines.push(`- **Close Pair:** ${fn.closePairId}`);
            if (fn.verificationMechanism) lines.push(`- **Verification:** ${fn.verificationMechanism}`);
        }

        lines.push('\n## Aggregated Services');
        fas.aggregatedServices.forEach(svc => lines.push(`- ${svc}`));

        return lines.join('\n');
    }
}
