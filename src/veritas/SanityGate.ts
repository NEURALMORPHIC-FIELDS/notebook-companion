import * as fs from 'fs';
import * as path from 'path';

export interface VeritasReport {
  total: number;
  wired: number;
  not_wired: number;
  critical_missing: string[];
  exit_code: 0 | 1 | 2;
}

export interface GateResult {
  blocked: boolean;
  reason?: string;
  details?: VeritasReport;
  wired?: string;
  not_wired?: number;
}

export class SanityGate {
  private memoryDir = path.join(process.cwd(), '.nexus', 'memory');
  private reportPath = path.join(this.memoryDir, 'veritas-report.json');

  async check(phase: string): Promise<GateResult> {
    // 1. Check if Veritas report exists (assumes VeritasRunner is called prior)
    if (!fs.existsSync(this.reportPath)) {
        return {
            blocked: true,
            reason: `Veritas report missing for Phase ${phase}. verify_project.py must run first.`
        };
    }

    // 2. Read report from .nexus/memory/veritas-report.json
    const reportData = fs.readFileSync(this.reportPath, 'utf8');
    const report: VeritasReport = JSON.parse(reportData);

    if (report.exit_code !== 0) {
      // BLOCKED — HITL does not open
      // exit_code 1 = critical modules NOT_WIRED (from verify_project.py)
      return {
        blocked: true,
        reason: `${report.critical_missing.length} CRITICAL modules NOT_WIRED`,
        details: report,
        // Agent CANNOT declare phase complete
        // Agent CANNOT request user approval
        // Agent MUST remediate before continuing
      };
    }

    // Only if exit_code === 0 → HITL opens
    return { 
        blocked: false,
        wired: report.wired + '/' + report.total,
        not_wired: report.not_wired 
    };
  }
}
