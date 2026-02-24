// SemanticStateTracker.ts — Parses module states from Veritas reports
import * as fs from 'fs';
import * as path from 'path';

export type ModuleCategory = 'WIRED' | 'NOT_WIRED' | 'TEST' | 'CONFIG';

export class SemanticStateTracker {
    private memoryDir = path.join(process.cwd(), '.nexus', 'memory');
    private reportPath = path.join(this.memoryDir, 'veritas-report.json');

    public getModuleCategory(moduleImportPath: string): ModuleCategory | 'UNKNOWN' {
        if (!fs.existsSync(this.reportPath)) return 'UNKNOWN';

        try {
            // In a real scenario, veritas-report.json would include the classified lists
            // For this implementation, we assume we need to re-parse or adapt the Python output.

            const reportData = fs.readFileSync(this.reportPath, 'utf8');
            const report = JSON.parse(reportData);

            // We check if the module is in the critical missing list
            if (report.critical_missing?.includes(moduleImportPath)) {
                return 'NOT_WIRED';
            }

            // If python script wrote the full classification, we'd look it up here
            // For now we return WIRED if it exists but is not critical_missing
            return 'WIRED';
        } catch (e) {
            console.error("[SemanticStateTracker] Failed to parse report:", e);
            return 'UNKNOWN';
        }
    }
}
