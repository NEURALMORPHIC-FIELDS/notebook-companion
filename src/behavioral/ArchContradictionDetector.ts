// ArchContradictionDetector.ts
// NEXUS AI Rule #5 — Every OPEN Has a Documented CLOSE Counterpart

export interface FASFunction {
    id: string;
    name: string;
    effectType?: 'OPEN' | 'CLOSE' | 'NEUTRAL';
    closePairId?: string;
}

export interface ComponentSpec {
    name: string;
    usesCache?: boolean;
    cacheNamespace?: string;
}

export interface FeedbackLoop {
    name: string;
    trigger?: string;
    verificationMechanism?: string;
}

export interface SystemConstant {
    name: string;
    value: any;
    isThreshold?: boolean;
    calibrationBasis?: string;
}

export interface Contradiction {
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    type: string;
    description: string;
    fix: string;
}

export class ArchContradictionDetector {
    public analyze(
        fasFunctions: FASFunction[],
        components: ComponentSpec[],
        feedbackLoops: FeedbackLoop[] = [],
        constants: SystemConstant[] = []
    ): Contradiction[] {
        const contradictions: Contradiction[] = [];

        // 1. Every OPEN function has a CLOSE counterpart in FAS?
        for (const fn of fasFunctions) {
            if (this.opensState(fn) && !this.hasCloseCounterpart(fn, fasFunctions)) {
                contradictions.push({
                    severity: 'CRITICAL',
                    type: 'MISSING_CLOSE',
                    description: `Function ${fn.id} '${fn.name}' opens state but has no EXIT counterpart documented in FAS`,
                    fix: 'Add EXIT function to FAS before continuing'
                });
            }
        }

        // 2. Every cache is namespaced per context?
        for (const component of components) {
            if (component.usesCache && !component.cacheNamespace) {
                contradictions.push({
                    severity: 'CRITICAL',
                    type: 'GLOBAL_CACHE',
                    description: `${component.name} uses global cache without namespace`,
                    fix: 'Add namespace_key to cache (e.g. symbol, user_id, session_id)'
                });
            }
        }

        // 3. Every feedback loop has a documented trigger?
        for (const loop of feedbackLoops) {
            if (!loop.trigger || !loop.verificationMechanism) {
                contradictions.push({
                    severity: 'HIGH',
                    type: 'BLIND_FEEDBACK_LOOP',
                    description: `Feedback loop ${loop.name} has no trigger or verification mechanism`,
                    fix: 'Document when the loop starts and how to verify it is working'
                });
            }
        }

        // 4. Are thresholds calibrated against real data?
        for (const constant of constants) {
            if (constant.isThreshold && !constant.calibrationBasis) {
                contradictions.push({
                    severity: 'HIGH',
                    type: 'UNCALIBRATED_THRESHOLD',
                    description: `Constant ${constant.name}=${constant.value} without justification against real data`,
                    fix: 'Document the real data distribution on which this value is calibrated'
                });
            }
        }

        return contradictions;
    }

    private opensState(fn: FASFunction): boolean {
        return fn.effectType === 'OPEN';
    }

    private hasCloseCounterpart(fn: FASFunction, allFns: FASFunction[]): boolean {
        if (!fn.closePairId) return false;
        return allFns.some(f => f.id === fn.closePairId && f.effectType === 'CLOSE');
    }
}
