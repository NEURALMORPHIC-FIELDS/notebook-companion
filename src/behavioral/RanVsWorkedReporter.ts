// RanVsWorkedReporter.ts — mandatory structure for any phase report
// NEXUS AI Rule #2 — 'Ran' != 'Worked Correctly'

export interface PhaseCompletionReport {
    // SECTION 1: DID IT RUN?
    execution: {
        completed_without_crash: boolean;
        exit_code: 0 | 1 | 2;
        duration_seconds: number;
        errors_caught: string[];
    };

    // SECTION 2: DID IT WORK CORRECTLY?
    correctness: {
        fas_functions_verified: {
            function_id: string;          // e.g. 'F-001'
            expected_effect: string;       // from FAS: what effect it must produce
            observed_effect: string;       // what was actually observed
            verified: boolean;             // expected effect == observed effect?
            evidence: string;             // concrete proof: log line, test output, metric
        }[];
        veritas_exit_code: 0 | 1 | 2;  // from verify_project.py
        integration_coverage: string;   // e.g. '12/17 COMPLETE (70.6%)'
    };

    // SECTION 3: WHAT DID NOT WORK (mandatory, not optional)
    known_incomplete: {
        item: string;
        state: 'DISABLED' | 'BUGGY' | 'UNVERIFIED' | 'PARTIAL';
        impact: string;
    }[];
}

export class RanVsWorkedReporter {
    public validateReport(report: PhaseCompletionReport): boolean {
        // If known_incomplete is empty and veritas_exit_code != 0 → invalid report
        if (report.known_incomplete.length === 0 && report.correctness.veritas_exit_code !== 0) {
            console.error("[ERROR] Validation Failed: known_incomplete is empty but Veritas exit_code != 0.");
            return false;
        }

        // Ensure all verified functions have evidence
        for (const func of report.correctness.fas_functions_verified) {
            if (func.verified && !func.evidence) {
                console.error(`[ERROR] Function ${func.function_id} marked verified without evidence.`);
                return false;
            }
        }

        return true;
    }

    public generateEmptyReport(): PhaseCompletionReport {
        return {
            execution: {
                completed_without_crash: false,
                exit_code: 2,
                duration_seconds: 0,
                errors_caught: []
            },
            correctness: {
                fas_functions_verified: [],
                veritas_exit_code: 2,
                integration_coverage: '0/0'
            },
            known_incomplete: []
        }
    }
}
