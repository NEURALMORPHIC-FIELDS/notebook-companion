// SessionManager.ts — Handles persistent memory in .nexus/
import * as fs from 'fs';
import * as path from 'path';

export interface ModuleClassification {
    wired: string[];
    notWired: string[];
    test: string[];
    config: string[];
}

export interface SessionState {
    veritas: {
        lastRun: string;
        exitCode: number;
        wired: number;
        notWired: number;
        total: number;
        criticalMissing: string[];
        history: any[];
    };
    moduleClassification: ModuleClassification;
    knownIncomplete: any[];
}

export class SessionManager {
    private baseDir = path.join(process.cwd(), '.nexus');
    private memoryDir = path.join(this.baseDir, 'memory');
    private sessionFile = path.join(this.baseDir, 'session.json');

    constructor() {
        this.initDirs();
    }

    private initDirs(): void {
        const dirsToCreate = [
            this.baseDir,
            this.memoryDir,
            path.join(this.baseDir, 'conversation'),
            path.join(this.baseDir, 'decisions'),
            path.join(this.baseDir, 'checkpoints'),
            path.join(this.baseDir, 'docs')
        ];

        dirsToCreate.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`[Memory] Created directory: ${dir}`);
            }
        });
    }

    public getSession(): SessionState | null {
        if (!fs.existsSync(this.sessionFile)) return null;
        const data = fs.readFileSync(this.sessionFile, 'utf8');
        return JSON.parse(data);
    }

    public writeSession(state: SessionState): void {
        // Atomic write (.tmp -> rename)
        const tmpFile = `${this.sessionFile}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
        fs.renameSync(tmpFile, this.sessionFile);
        console.log(`[Memory] Session state persisted atomically to ${this.sessionFile}`);
    }

    public appendKnownIncomplete(item: any): void {
        const registryPath = path.join(this.memoryDir, 'known-incomplete.json');
        let registry = [];
        if (fs.existsSync(registryPath)) {
            registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        }
        registry.push(item);

        // Atomic write
        const tmpFile = `${registryPath}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(registry, null, 2), 'utf8');
        fs.renameSync(tmpFile, registryPath);
        console.log(`[Memory] Appended item to Known Incomplete Registry`);
    }
}
