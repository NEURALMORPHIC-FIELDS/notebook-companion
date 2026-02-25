/**
 * SanityGate.ts — Pre-HITL verification gate
 * NEXUS AI v6 — Veritas Ground Truth System (§2.3 ARCHITECTURE.md)
 *
 * PRINCIPLE: Agents cannot declare a phase complete if Veritas exit_code ≠ 0.
 * SanityGate reads the last Veritas report and blocks the HITL panel if
 * critical modules are NOT_WIRED.
 *
 * Browser-safe: reads from localStorage (written by VeritasRunner).
 * No fs, no path, no Node.js dependencies.
 */

import { VeritasRunner, type VeritasReport } from './VeritasRunner';

export interface GateResult {
  blocked: boolean;
  reason?: string;
  details?: VeritasReport;
  wired?: string;      // e.g. "14/17"
  not_wired?: number;
}

export class SanityGate {
  /**
   * Check if the current Veritas state allows the HITL panel to open.
   *
   * @param phase The current SDLC phase (used only for error messaging)
   * @returns GateResult — blocked=true prevents HITL approval panel from opening
   *
   * ARCHITECTURE.md §2.3:
   *   exit_code = 0  → blocked: false  → HITL opens
   *   exit_code ≠ 0  → blocked: true   → HITL stays closed, agent must remediate
   */
  public async check(phase: string): Promise<GateResult> {
    const report = VeritasRunner.loadReport();

    if (!report) {
      return {
        blocked: true,
        reason: `Veritas report missing for Phase ${phase}. Run Veritas first.`,
      };
    }

    if (report.exit_code !== 0) {
      // Sanity Gate BLOCKED — agent CANNOT declare phase complete
      // Agent CANNOT request user approval
      // Agent MUST remediate before continuing
      return {
        blocked: true,
        reason: `${report.critical_missing.length} CRITICAL module(s) NOT_WIRED`,
        details: report,
      };
    }

    // Gate passes — HITL can open
    return {
      blocked: false,
      wired: `${report.wired}/${report.total}`,
      not_wired: report.not_wired,
    };
  }
}
