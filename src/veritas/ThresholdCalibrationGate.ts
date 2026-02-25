/**
 * ThresholdCalibrationGate.ts — detect uncalibrated magic constants
 * NEXUS AI v6 — Behavioral Rule #7 (§3.6 ARCHITECTURE.md)
 *
 * ARCHITECTURE.md Rule #7:
 *   "Threshold Calibration Gate — no magic constant without justification.
 *    Real failure: negentropy_threshold=0.1 with real values 1.8-8.7.
 *    Flag rate > 50% → UNCALIBRATED."
 *
 * Every threshold in the system MUST have a documented calibration_basis.
 * An uncalibrated threshold is treated as a CRITICAL architectural issue.
 */

export interface SystemThreshold {
    name: string;              // e.g. "similarity_threshold"
    value: number | string;    // The actual constant value
    unit?: string;             // e.g. "ratio", "ms", "tokens"
    calibrationBasis?: string; // Description of real data used to set this value
    expectedRange?: {          // What values does this metric realistically take?
        min: number;
        max: number;
        typical: number;
    };
    flagRatePercent?: number;  // Observed: what % of inputs does this flag?
}

export interface CalibrationIssue {
    severity: 'CRITICAL' | 'HIGH';
    threshold: SystemThreshold;
    reason: string;
    recommendation: string;
}

export class ThresholdCalibrationGate {
    /**
     * Validate a list of thresholds.
     * Returns calibration issues that must be remediated before Phase 4 completes.
     *
     * CRITICAL if:
     *   - No calibration_basis documented
     *   - flagRatePercent > 50% (flags more than half of inputs)
     *
     * HIGH if:
     *   - flagRatePercent > 30% (flags a substantial portion of inputs)
     */
    public validate(thresholds: SystemThreshold[]): CalibrationIssue[] {
        const issues: CalibrationIssue[] = [];

        for (const threshold of thresholds) {
            // Check 1: Missing calibration basis = magic constant
            if (!threshold.calibrationBasis || threshold.calibrationBasis.trim() === '') {
                issues.push({
                    severity: 'CRITICAL',
                    threshold,
                    reason: `Threshold "${threshold.name}=${threshold.value}" has no calibration_basis. This is a magic constant.`,
                    recommendation: 'Document the real data distribution on which this value was calibrated.',
                });
                continue; // Skip flag rate check if no basis
            }

            // Check 2: Flag rate too high
            if (threshold.flagRatePercent !== undefined) {
                if (threshold.flagRatePercent > 50) {
                    issues.push({
                        severity: 'CRITICAL',
                        threshold,
                        reason: `Threshold "${threshold.name}" flags ${threshold.flagRatePercent.toFixed(1)}% of inputs (>50%). System appears to mis-detect normal behavior as anomaly.`,
                        recommendation: 'Recalibrate threshold against production-representative data.',
                    });
                } else if (threshold.flagRatePercent > 30) {
                    issues.push({
                        severity: 'HIGH',
                        threshold,
                        reason: `Threshold "${threshold.name}" flags ${threshold.flagRatePercent.toFixed(1)}% of inputs (>30%). Check if expected range aligns with real data.`,
                        recommendation: 'Verify threshold against real data sample. Document percentile used.',
                    });
                }
            }
        }

        if (issues.length > 0) {
            console.warn('[ThresholdCalibrationGate] Calibration issues found:', issues.length);
        } else {
            console.info('[ThresholdCalibrationGate] All thresholds calibrated. Gate passed.');
        }

        return issues;
    }

    /**
     * Quick check: any CRITICAL calibration issues?
     * Returns true if the gate passes (no CRITICAL issues).
     */
    public passes(thresholds: SystemThreshold[]): boolean {
        const issues = this.validate(thresholds);
        return !issues.some(i => i.severity === 'CRITICAL');
    }
}
