/**
 * code-executor/index.ts — Supabase Edge Function (Deno)
 * NEXUS AI v6 — Sprint A: Code Execution Sandbox
 *
 * Executes TypeScript/JavaScript code via Piston API (https://github.com/engineer-man/piston).
 * Piston provides a fully isolated sandbox with hard CPU/memory/time limits.
 *
 * Why Piston instead of Deno.Command:
 *   - Supabase Edge Runtime does not allow spawning subprocesses (Deno.Command blocked).
 *   - Piston runs code in isolated containers — full sandbox, no escape possible.
 *   - Public instance at emkc.org is free, no API key required.
 *   - Supports JS (Node 18) and TypeScript (5.x) natively.
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

// Judge0 CE — open source, sandboxed, no API key required on public instance
// Language ID 63 = JavaScript (Node.js 12.14.0)
// Docs: https://ce.judge0.com / https://github.com/judge0/judge0
const JUDGE0_URL = "https://ce.judge0.com/submissions?base64_encoded=false&wait=true";
const JUDGE0_LANGUAGE_JS = 63;   // JavaScript Node.js 12
const JUDGE0_LANGUAGE_TS = 74;   // TypeScript 3.7

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
    toThrow: (expected) => {
      if (typeof val !== "function") throw new Error("toThrow() expects a function");
      let thrown = false;
      let thrownValue = null;
      try {
        val();
      } catch (error) {
        thrown = true;
        thrownValue = error;
      }
      if (!thrown) throw new Error("Expected function to throw, but it did not throw");
      if (expected !== undefined) {
        const message = thrownValue instanceof Error ? thrownValue.message : String(thrownValue);
        if (expected instanceof RegExp && !expected.test(message)) {
          throw new Error(\`Expected thrown error to match \${expected}, got "\${message}"\`);
        }
        if (typeof expected === "string" && !message.includes(expected)) {
          throw new Error(\`Expected thrown error to include "\${expected}", got "\${message}"\`);
        }
      }
    },
    not: {
      toBe: (expected) => { if (val === expected) throw new Error(\`Expected not \${expected}\`); },
      toBeTruthy: () => { if (val) throw new Error(\`Expected falsy\`); },
      toThrow: () => {
        if (typeof val !== "function") throw new Error("not.toThrow() expects a function");
        try {
          val();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(\`Expected function not to throw, but it threw: "\${message}"\`);
        }
      },
    }
  };
}

// ── User Code ────────────────────────────────────────────────────────────────
${code}
// ── Test Results ─────────────────────────────────────────────────────────────
console.log(JSON.stringify({ __nexus_test_results: __results }));
`;
}

// ── Main executor — Judge0 CE ─────────────────────────────────────────────────

async function executeCode(req: ExecRequest): Promise<ExecResponse> {
    const language = req.language ?? 'typescript';
    const mode = req.mode ?? 'run';
    const timeoutSec = Math.min(req.timeout ?? EXEC_TIMEOUT_MS, EXEC_TIMEOUT_MS) / 1000;

    const codeToRun = mode === 'test' ? buildTestWrapper(req.code) : req.code;

    // Judge0 language: TypeScript runs the test harness as JS (harness is pure JS)
    // For production TS with types, use JUDGE0_LANGUAGE_TS
    const languageId = language === 'typescript' ? JUDGE0_LANGUAGE_JS : JUDGE0_LANGUAGE_JS;

    const t0 = Date.now();

    const judge0Resp = await fetch(JUDGE0_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source_code: codeToRun,
            language_id: languageId,
            stdin: '',
            cpu_time_limit: timeoutSec,
            wall_time_limit: timeoutSec + 2,  // extra 2s for Judge0 overhead
            memory_limit: 131072,             // 128 MB in KB
        }),
        signal: AbortSignal.timeout((timeoutSec + 10) * 1000),  // extra 10s network
    });

    const duration = Date.now() - t0;

    if (!judge0Resp.ok) {
        const errText = await judge0Resp.text().catch(() => 'Unknown error');
        throw new Error(`Judge0 error ${judge0Resp.status}: ${errText}`);
    }

    const data = await judge0Resp.json() as {
        stdout: string | null;
        stderr: string | null;
        compile_output: string | null;
        message: string | null;
        exit_code: number | null;
        status: { id: number; description: string } | null;
    };

    const stdoutStr = sanitize(data.stdout ?? '');
    // Merge stderr + compile_output for full error context
    const stderrRaw = [data.stderr, data.compile_output, data.message]
        .filter(Boolean).join('\n').trim();
    const stderrStr = sanitize(stderrRaw);

    // Judge0 status IDs: 3=Accepted, 4=WA, 5=TLE, 6=CE, 11=RE, etc.
    const statusId = data.status?.id ?? 0;
    const timedOut = statusId === 5;    // Time Limit Exceeded
    const exitCode = statusId === 3 ? 0 : 1;

    if (mode === 'test') {
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
            stderr: timedOut ? `[Time Limit Exceeded — ${timeoutSec}s]` : stderrStr,
            exit_code: exitCode,
            duration_ms: duration,
            mode: 'test',
            tests,
            tests_passed: testsPassed,
            tests_failed: testsFailed,
        };
    }

    return {
        stdout: stdoutStr,
        stderr: timedOut ? `[Time Limit Exceeded — ${timeoutSec}s]` : stderrStr,
        exit_code: exitCode,
        duration_ms: duration,
        mode: 'run',
    };
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
