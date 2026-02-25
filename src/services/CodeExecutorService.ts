/**
 * CodeExecutorService.ts — Browser client for code-executor edge function
 * NEXUS AI v6 — Sprint A
 *
 * Calls the code-executor Supabase Edge Function with code and returns
 * stdout, stderr, exit_code, duration_ms, and test results.
 */

const EXECUTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/code-executor`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface ExecResult {
    stdout: string;
    stderr: string;
    exit_code: number;
    duration_ms: number;
    mode: 'run' | 'test';
    // Test mode only
    tests?: TestResult[];
    tests_passed?: number;
    tests_failed?: number;
}

export interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    duration_ms: number;
}

export interface ExecOptions {
    language?: 'typescript' | 'javascript';
    mode?: 'run' | 'test';
    timeout?: number;  // ms, server caps at 10000
}

/**
 * Execute code in the server-side Deno sandbox.
 * Throws on network error or HTTP error.
 * On code execution error (non-zero exit), still resolves — check exit_code.
 */
export async function executeCode(code: string, options: ExecOptions = {}): Promise<ExecResult> {
    const resp = await fetch(EXECUTOR_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
            code,
            language: options.language ?? 'typescript',
            mode: options.mode ?? 'run',
            timeout: options.timeout,
        }),
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Unknown error');
        throw new Error(`code-executor HTTP ${resp.status}: ${errText}`);
    }

    return resp.json() as Promise<ExecResult>;
}

/**
 * Run test code against source code.
 * Returns verdict: 'pass' | 'fail' | 'error'
 */
export async function runTests(
    sourceCode: string,
    testCode: string,
    language: 'typescript' | 'javascript' = 'typescript',
): Promise<ExecResult> {
    const combined = `${sourceCode}\n\n// ── Tests ──\n${testCode}`;
    return executeCode(combined, { language, mode: 'test' });
}
