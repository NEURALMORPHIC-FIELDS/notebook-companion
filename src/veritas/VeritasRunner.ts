// VeritasRunner.ts — executes verify_project.py and generates veritas-report.json
import { exec } from 'child_process';
import * as path from 'path';

export class VeritasRunner {
    private projectRoot = process.cwd();
    private scriptPath = path.join(this.projectRoot, 'verify_project.py');

    public async runVeritas(verbose: boolean = false): Promise<number> {
        return new Promise((resolve, reject) => {
            console.log(`[VeritasRunner] Executing: python verify_project.py`);
            const args = verbose ? '--verbose' : '';

            exec(`python ${this.scriptPath} ${args}`, { cwd: this.projectRoot }, (error, stdout, stderr) => {
                if (stdout) {
                    console.log(stdout);
                }
                if (stderr) {
                    console.error(stderr);
                }

                // Return exactly the exit code. 0 = all WIRED, 1 = NOT_WIRED criticals
                if (error) {
                    resolve(error.code || 1);
                } else {
                    resolve(0);
                }
            });
        });
    }
}
