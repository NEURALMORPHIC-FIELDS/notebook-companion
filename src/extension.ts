// src/extension.ts — Entry point for NEXUS AI VS Code Extension
import { AgentOrchestrator } from './orchestrator/AgentOrchestrator';
import { SessionManager } from './memory/SessionManager';
import { VeritasRunner } from './veritas/VeritasRunner';

export async function activate() {
    console.log('[NEXUS AI v6] Extension Activated');

    // Initialize Memory System
    const sessionManager = new SessionManager();

    // 1. Run Veritas before anything else
    const veritas = new VeritasRunner();
    const exitCode = await veritas.runVeritas([], true);

    if (exitCode !== 0) {
        console.error(`[NEXUS AI] Initial Veritas Check Failed (Code 1). Some critical modules are missing.`);
        // In a real extension, we would show a warning to the user here.
    } else {
        console.log(`[NEXUS AI] Veritas Check Passed.`);
    }

    // 2. Initialize Orchestrator  
    const orchestrator = new AgentOrchestrator();

    // Test Phase 1A execution
    await orchestrator.runPhase('1A', 'Initialize project documentation');
}

export function deactivate() {
    console.log('[NEXUS AI v6] Extension Deactivated');
}

// Simple test run for manual invocation
import { fileURLToPath } from 'url';

const isMainModule = typeof require !== 'undefined'
    ? require.main === module
    : process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
    activate().catch(console.error);
}
