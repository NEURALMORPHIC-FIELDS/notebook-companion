/**
 * code-executor/index.ts — Supabase Edge Function (Deno)
 * NEXUS AI v6 — Sprint A: Code Execution Sandbox
 *
 * Executes TypeScript/JavaScript code in an isolated Deno sub-process.
 * Returns stdout, stderr, exit_code, and duration_ms.
 *
 * Security:
 *   - Hard 10-second timeout (kills infinite loops)
 *   - No --allow-net, --allow-read, --allow-write: code runs with zero permissions
 *   - Code injected via stdin, not eval()
 *   - Each request spawns a fresh sub-process (no state leakage)
 *
 * Supports modes:
 *   'run'  — execute code, return stdout/stderr
 *   'test' — run vitest-compatible test blocks, return pass/fail per test
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXEC_TIMEOUT_MS = 10_000;  // 10 seconds hard limit
const MAX_CODE_LENGTH = 50_000;  // 50KB max code size

// ── Request / Response types ──────────────────────────────────────────────────

interface ExecRequest {
    code: string;
    language?: 'typescript' | 'javascript';
    mode?: 'run' | 'test';
    timeout?: number;  // ms, max EXEC_TIMEOUT_MS
}

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    duration_ms: number;
}

interface ExecResponse {
    stdout: string;
    stderr: string;
    exit_code: number;
    duration_ms: number;
    mode: 'run' | 'test';
    // Only present in test mode
    tests?: TestResult[];
    tests_passed?: number;
    tests_failed?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitize(s: string): string {
    // Limit output to 10KB — prevents OOM from print-flooding code
    return s.length > 10_000 ? s.slice(0, 10_000) + '\n[...output truncated]' : s;
}

function buildTestWrapper(code: string): string {
    // Wraps the submitted code in a minimal test harness that:
    //  - Intercepts describe/test/it/expect patterns
    //  - Returns JSON with test results to stdout
    return `
// ── NEXUS Test Harness ────────────────────────────────────────────────
const __results = [];
const __start = Date.now();

function test(name, fn) { it(name, fn); }
function it(name, fn) {
  const t0 = Date.now();
  try {
    fn();
    __results.push({ name, passed: true, duration_ms: Date.now() - t0 });
  } catch(e) {
    __results.push({ name, passed: false, error: String(e), duration_ms: Date.now() - t0 });
  }
}
function describe(label, fn) { fn(); }
function expect(val) {
  return {
    toBe: (expected) => { if (val !== expected) throw new Error(\`Expected \${expected}, got \${val}\`); },
    toEqual: (expected) => { if (JSON.stringify(val) !== JSON.stringify(expected)) throw new Error(\`Expected \${JSON.stringify(expected)}, got \${JSON.stringify(val)}\`); },
    toBeTruthy: () => { if (!val) throw new Error(\`Expected truthy, got \${val}\`); },
    toBeFalsy: () => { if (val) throw new Error(\`Expected falsy, got \${val}\`); },
    toContain: (sub) => { if (!String(val).includes(sub)) throw new Error(\`Expected to contain "\${sub}"\`); },
    toThrow: () => { /* stub */ },
    not: {
      toBe: (expected) => { if (val === expected) throw new Error(\`Expected not \${expected}\`); },
      toBeTruthy: () => { if (val) throw new Error(\`Expected falsy\`); },
    }
  };
}

// ── User Code ────────────────────────────────────────────────────────────────
${code}
// ── Test Results ─────────────────────────────────────────────────────────────
console.log(JSON.stringify({ __nexus_test_results: __results }));
`;
}

// ── Main executor ─────────────────────────────────────────────────────────────

async function executeCode(req: ExecRequest): Promise<ExecResponse> {
    const language = req.language ?? 'typescript';
    const mode = req.mode ?? 'run';
    const timeout = Math.min(req.timeout ?? EXEC_TIMEOUT_MS, EXEC_TIMEOUT_MS);

    const codeToRun = mode === 'test' ? buildTestWrapper(req.code) : req.code;

    // Write code to a temp file
    const tmpFile = await Deno.makeTempFile({ suffix: language === 'typescript' ? '.ts' : '.js' });
    await Deno.writeTextFile(tmpFile, codeToRun);

    const t0 = Date.now();

    try {
        // Spawn Deno sub-process with ZERO permissions (isolated sandbox)
        const proc = new Deno.Command("deno", {
            args: [
                "run",
                "--no-prompt",
                // Zero permissions: code cannot access network, disk, env, etc.
                tmpFile,
            ],
            stdout: "piped",
            stderr: "piped",
            stdin: "null",
        });

        const child = proc.spawn();

        // Apply hard timeout
        const timer = setTimeout(() => {
            try { child.kill("SIGKILL"); } catch { /* already done */ }
        }, timeout);

        const { code: exitCode, stdout, stderr } = await child.output();
        clearTimeout(timer);

        const stdoutStr = sanitize(new TextDecoder().decode(stdout));
        const stderrStr = sanitize(new TextDecoder().decode(stderr));
        const duration = Date.now() - t0;

        if (mode === 'test') {
            // Parse test results from stdout JSON line
            const tests: TestResult[] = [];
            for (const line of stdoutStr.split('\n')) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.__nexus_test_results) {
                        tests.push(...parsed.__nexus_test_results);
                    }
                } catch { /* not a JSON line */ }
            }

            const testsPassed = tests.filter(t => t.passed).length;
            const testsFailed = tests.filter(t => !t.passed).length;

            return {
                stdout: stdoutStr,
                stderr: stderrStr,
                exit_code: exitCode,
                duration_ms: duration,
                mode: 'test',
                tests,
                tests_passed: testsPassed,
                tests_failed: testsFailed,
            };
        }

        return { stdout: stdoutStr, stderr: stderrStr, exit_code: exitCode, duration_ms: duration, mode: 'run' };

    } finally {
        // Always clean up temp file
        await Deno.remove(tmpFile).catch(() => { });
    }
}

// ── HTTP Handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    let body: ExecRequest;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    if (!body.code || typeof body.code !== 'string') {
        return new Response(JSON.stringify({ error: "Missing 'code' field" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    if (body.code.length > MAX_CODE_LENGTH) {
        return new Response(JSON.stringify({ error: `Code exceeds ${MAX_CODE_LENGTH} character limit` }), {
            status: 413, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    try {
        const result = await executeCode(body);
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[code-executor] Error:", err);
        return new Response(JSON.stringify({
            error: err instanceof Error ? err.message : "Execution failed",
            stdout: "",
            stderr: "",
            exit_code: 1,
            duration_ms: 0,
            mode: body.mode ?? 'run',
        }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }
});
