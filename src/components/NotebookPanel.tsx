import { useState, useEffect, useCallback } from "react";
import { collectSseStream } from "@/utils/sseParser";
import { executeCode, runTests, type ExecResult } from "@/services/CodeExecutorService";
import { motion } from "framer-motion";
import {
  Play, Trash2, CheckCircle, XCircle, Terminal,
  FileCode, Bot, Loader2, Cpu, Wand2, RefreshCw,
  Shield, Bug, BookOpen, Layers, PlayCircle, Zap, FlaskConical
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────
interface ReviewResult {
  agent: string;
  status: 'pending' | 'running' | 'done' | 'error';
  output: string;
}

interface CodeEntry {
  id: string;
  sourceAgent: string;
  phase: string;
  code: string;
  language: string;
  description: string;
  timestamp: string;
  reviews: ReviewResult[];
  overallStatus: 'pending' | 'running' | 'passed' | 'issues' | 'error';
  // Execution
  execResult?: ExecResult;
  execStatus?: 'idle' | 'running' | 'done' | 'error';
  // Tests (Sprint D)
  testResult?: ExecResult;
  testStatus?: 'idle' | 'running' | 'done' | 'error';
}

// ─── Review Agents Pipeline ──────────────────────────
const REVIEW_PIPELINE = [
  {
    id: 'code-reviewer',
    label: 'Code Reviewer',
    icon: Bug,
    prompt: 'You are the Code Reviewer agent. Analyze this code for bugs, silent drops, code smells, unused variables, and best practices violations. Return a structured review with severity (CRITICAL/WARNING/INFO). Be concise, max 150 words.',
  },
  {
    id: 'qa-engineer',
    label: 'QA Engineer',
    icon: CheckCircle,
    prompt: 'You are the QA Engineer agent. For this code, generate 3-5 key unit test cases with expected behaviors. Format as a test plan table. Be concise, max 150 words.',
  },
  {
    id: 'security-auditor',
    label: 'Security Auditor',
    icon: Shield,
    prompt: 'You are the Security Auditor. Perform OWASP-aligned security review of this code. Check for injection, XSS, CSRF, auth issues, data exposure. Output PASS/FAIL per category. Be concise, max 150 words.',
  },
  {
    id: 'architect',
    label: 'Architect',
    icon: Layers,
    prompt: 'You are the Architect agent. Evaluate this code for SOLID compliance, coupling, cohesion, and scalability. Rate architecture quality 1-10. Be concise, max 100 words.',
  },
];

const STORAGE_KEY = 'nexus-notebook-entries';
const EVENT_NAME = 'nexus-notebook-submit';
const REVIEW_REQUIRED_PHASES = new Set(['6A', '6B']);

// ─── LLM — uses agent-llm edge function ─────────────
const AGENT_LLM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-llm`;

async function callReviewAgent(agentRole: string, systemPrompt: string, code: string): Promise<string> {
  const resp = await fetch(AGENT_LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      agentRole,
      messages: [{ role: 'user', content: `${systemPrompt}\n\nReview this code:\n\n\`\`\`\n${code}\n\`\`\`` }],
      phase: '7',
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  if (!resp.body) throw new Error('No response body received.');
  // SSE parsing via shared utility (src/utils/sseParser.ts)
  const result = await collectSseStream(resp.body);
  return result || 'No response received.';
}


// ─── Persistence ─────────────────────────────────────
function loadEntries(): CodeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistEntries(entries: CodeEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { }
}

// ─── Global API for agents to submit code ────────────
// Agents call: window.dispatchEvent(new CustomEvent('nexus-notebook-submit', { detail: { ... } }))
// Or: (window as any).nexusNotebook.submit({ sourceAgent, phase, code, language, description })
(window as any).nexusNotebook = {
  submit: (entry: { sourceAgent: string; phase: string; code: string; language?: string; description?: string }) => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: entry }));
  },
};

// ═══════════════════════════════════════════════════════
export default function NotebookPanel() {
  const [entries, setEntries] = useState<CodeEntry[]>(loadEntries);

  useEffect(() => { persistEntries(entries); }, [entries]);

  // Listen for agent submissions
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.code) return;
      const newEntry: CodeEntry = {
        id: `nb-${Date.now()}`,
        sourceAgent: detail.sourceAgent || 'Unknown Agent',
        phase: detail.phase || '?',
        code: detail.code,
        language: detail.language || 'typescript',
        description: detail.description || '',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        reviews: REVIEW_PIPELINE.map(r => ({ agent: r.label, status: 'pending' as const, output: '' })),
        overallStatus: REVIEW_REQUIRED_PHASES.has(detail.phase || '?') ? 'pending' : 'passed',
      };
      setEntries(prev => [newEntry, ...prev]);
      if (newEntry.overallStatus === 'pending') {
        toast.success(`Phase ${newEntry.phase} output queued for review`);
      } else {
        toast.success(`Phase ${newEntry.phase} output saved to Notebook`);
      }

    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  // Run all review agents on a code entry
  const runPipeline = useCallback(async (entryId: string) => {
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, overallStatus: 'running' as const } : e
    ));

    for (let i = 0; i < REVIEW_PIPELINE.length; i++) {
      const reviewer = REVIEW_PIPELINE[i];

      // Mark current reviewer as running
      setEntries(prev => prev.map(e => {
        if (e.id !== entryId) return e;
        const reviews = [...e.reviews];
        reviews[i] = { ...reviews[i], status: 'running' };
        return { ...e, reviews };
      }));

      try {
        const entry = entries.find(e => e.id === entryId) || loadEntries().find(e => e.id === entryId);
        if (!entry) break;
        const output = await callReviewAgent(reviewer.id, reviewer.prompt, entry.code);

        setEntries(prev => prev.map(e => {
          if (e.id !== entryId) return e;
          const reviews = [...e.reviews];
          reviews[i] = { agent: reviewer.label, status: 'done', output };
          return { ...e, reviews };
        }));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        setEntries(prev => prev.map(e => {
          if (e.id !== entryId) return e;
          const reviews = [...e.reviews];
          reviews[i] = { agent: reviewer.label, status: 'error', output: `ERROR: ${errMsg}` };
          return { ...e, reviews };
        }));
      }
    }

    // Set overall status
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const hasError = e.reviews.some(r => r.status === 'error');
      return { ...e, overallStatus: hasError ? 'issues' : 'passed' };
    }));
  }, [entries]);

  // Execute code in server-side Deno sandbox
  const runExecutor = useCallback(async (entryId: string) => {
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, execStatus: 'running' as const } : e
    ));
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    try {
      const result = await executeCode(entry.code, {
        language: entry.language === 'typescript' ? 'typescript' : 'javascript',
        mode: 'run',
      });
      setEntries(prev => prev.map(e =>
        e.id === entryId
          ? { ...e, execResult: result, execStatus: result.exit_code === 0 ? 'done' : 'error' }
          : e
      ));
      if (result.exit_code === 0) {
        toast.success(`Executed in ${result.duration_ms}ms — exit 0`);
      } else {
        toast.error(`Execution failed — exit ${result.exit_code}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution error';
      setEntries(prev => prev.map(e =>
        e.id === entryId ? { ...e, execStatus: 'error' as const } : e
      ));
      toast.error(msg);
    }
  }, [entries]);

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const clearAll = () => {
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Run Tests for entry — calls Deno sandbox in test mode (Sprint D)
  const runTestsForEntry = useCallback(async (entryId: string) => {
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, testStatus: 'running' as const } : e
    ));
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    try {
      const result = await runTests(
        entry.code,
        entry.code,
        entry.language === 'typescript' ? 'typescript' : 'javascript',
      );
      setEntries(prev => prev.map(e =>
        e.id === entryId
          ? { ...e, testResult: result, testStatus: result.exit_code === 0 ? 'done' : 'error' }
          : e
      ));
      const passed = result.tests_passed ?? 0;
      const failed = result.tests_failed ?? 0;
      if (failed === 0) {
        toast.success(`Tests: ${passed} passed, 0 failed`);
      } else {
        toast.error(`Tests: ${passed} passed, ${failed} FAILED`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Test error';
      setEntries(prev => prev.map(e =>
        e.id === entryId ? { ...e, testStatus: 'error' as const } : e
      ));
      toast.error(msg);
    }
  }, [entries]);

  // Demo: simulate an agent submitting code
  const simulateAgentSubmission = () => {
    (window as any).nexusNotebook.submit({
      sourceAgent: 'Backend Engineer',
      phase: '6A',
      code: `import express from 'express';\nconst app = express();\n\napp.get('/api/todos', (req, res) => {\n  const todos = db.query('SELECT * FROM todos WHERE user_id = ' + req.query.userId);\n  res.json(todos);\n});\n\napp.post('/api/todos', (req, res) => {\n  const { title } = req.body;\n  db.query(\`INSERT INTO todos (title) VALUES ('\${title}')\`);\n  res.status(201).json({ ok: true });\n});\n\napp.listen(3000);`,
      language: 'typescript',
      description: 'REST API endpoints for todo CRUD operations',
    });
  };

  const llmLabel = 'Lovable AI (agent-llm)';

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold nexus-gradient-text">Agent Notebook</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Autonomous code sandbox — agents submit code, review pipeline runs automatically
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={simulateAgentSubmission}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <PlayCircle size={14} /> Simulate Agent Submit
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Pipeline Info */}
      <div className="flex items-center gap-4 flex-wrap text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Cpu size={11} className="text-primary" /> LLM: <span className="text-primary font-bold">{llmLabel}</span>
        </span>
        <span className="h-3 w-px bg-border" />
        <span>Pipeline: {REVIEW_PIPELINE.map(r => r.label).join(' → ')}</span>
        <span className="h-3 w-px bg-border" />
        <span>{entries.length} entries</span>
      </div>

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="nexus-card rounded-xl p-10 text-center">
          <Terminal size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No code submitted yet.</p>
          <p className="text-xs text-muted-foreground/70">
            Agents submit code via <code className="text-primary">window.nexusNotebook.submit({"{}"})</code> or click "Simulate" to demo.
          </p>
        </div>
      )}

      {/* Code Entries */}
      {entries.map((entry, idx) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.03 }}
          className={`nexus-card rounded-lg overflow-hidden ${entry.overallStatus === 'passed' ? 'border-nexus-green/30'
            : entry.overallStatus === 'issues' || entry.overallStatus === 'error' ? 'border-nexus-red/30'
              : ''
            }`}
        >
          {/* Entry Header */}
          <div className="flex items-center gap-2 px-4 py-2 bg-nexus-surface-hover border-b border-nexus-border-subtle">
            <Bot size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">{entry.sourceAgent}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">Phase {entry.phase}</span>
            {entry.description && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[300px]">— {entry.description}</span>
            )}
            <span className="text-[9px] font-mono text-muted-foreground/60 ml-auto">{entry.timestamp}</span>
            <div className="flex items-center gap-1 ml-2">
              {entry.overallStatus === 'pending' && (
                <button
                  onClick={() => runPipeline(entry.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-nexus-green-dim text-nexus-green hover:bg-nexus-green/20 transition-colors"
                >
                  <Play size={10} /> Run Pipeline
                </button>
              )}
              {entry.overallStatus === 'running' && (
                <span className="flex items-center gap-1 px-2 py-1 text-[10px] text-nexus-amber">
                  <Loader2 size={10} className="animate-spin" /> Reviewing...
                </span>
              )}
              {(entry.overallStatus === 'passed' || entry.overallStatus === 'issues') && (
                <>
                  <button
                    onClick={() => runPipeline(entry.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    <RefreshCw size={10} /> Re-run
                  </button>
                  {/* Execute button — calls Deno sandbox */}
                  <button
                    onClick={() => runExecutor(entry.id)}
                    disabled={entry.execStatus === 'running'}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-nexus-amber/10 text-nexus-amber border border-nexus-amber/20 hover:bg-nexus-amber/20 transition-colors disabled:opacity-50"
                  >
                    {entry.execStatus === 'running'
                      ? <><Loader2 size={10} className="animate-spin" /> Executing...</>
                      : <><Zap size={10} /> Execute</>}
                  </button>
                  {/* Run Tests button — Sprint D */}
                  <button
                    onClick={() => runTestsForEntry(entry.id)}
                    disabled={entry.testStatus === 'running'}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-nexus-blue/10 text-nexus-blue border border-nexus-blue/20 hover:bg-nexus-blue/20 transition-colors disabled:opacity-50"
                  >
                    {entry.testStatus === 'running'
                      ? <><Loader2 size={10} className="animate-spin" /> Testing...</>
                      : <><FlaskConical size={10} /> Run Tests</>}
                  </button>
                </>
              )}
              <button
                onClick={() => deleteEntry(entry.id)}
                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Source Code */}
          <pre className="bg-nexus-deep text-foreground font-mono text-xs p-4 overflow-x-auto max-h-[200px] overflow-y-auto">
            <code>{entry.code}</code>
          </pre>

          {/* Review Results */}
          {entry.reviews.some(r => r.status !== 'pending') && (
            <div className="border-t border-nexus-border-subtle">
              {entry.reviews.map((review, ri) => {
                const pipelineAgent = REVIEW_PIPELINE[ri];
                const Icon = pipelineAgent?.icon || Bot;
                if (review.status === 'pending') return null;
                return (
                  <div
                    key={ri}
                    className={`px-4 py-3 border-b border-nexus-border-subtle/50 last:border-b-0 ${review.status === 'error' ? 'bg-nexus-red-dim/5' : 'bg-card/50'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {review.status === 'running' ? (
                        <Loader2 size={11} className="animate-spin text-nexus-amber" />
                      ) : review.status === 'error' ? (
                        <XCircle size={11} className="text-nexus-red" />
                      ) : (
                        <Icon size={11} className="text-nexus-green" />
                      )}
                      <span className="text-[10px] font-mono font-bold text-foreground">{review.agent}</span>
                      {review.status === 'running' && (
                        <span className="text-[9px] text-nexus-amber">analyzing...</span>
                      )}
                      {review.status === 'done' && (
                        <span className="text-[9px] text-nexus-green">✓ complete</span>
                      )}
                    </div>
                    {review.output && (
                      <div className={`text-xs font-mono whitespace-pre-wrap leading-relaxed pl-5 ${review.status === 'error' ? 'text-nexus-red' : 'text-muted-foreground'
                        }`}>
                        {review.output}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Overall Status Badge */}
          {entry.overallStatus === 'passed' && (
            <div className="px-4 py-2 bg-nexus-green/5 flex items-center gap-2 text-[10px] font-mono text-nexus-green">
              <CheckCircle size={12} /> All 4 agents passed review
            </div>
          )}
          {entry.overallStatus === 'issues' && (
            <div className="px-4 py-2 bg-nexus-red/5 flex items-center gap-2 text-[10px] font-mono text-nexus-red">
              <XCircle size={12} /> Review completed with issues — check findings above
            </div>
          )}

          {/* Execution Terminal Output */}
          {entry.execResult && (
            <div className="border-t border-nexus-border-subtle">
              <div className="flex items-center gap-2 px-4 py-2 bg-nexus-deep">
                <Terminal size={11} className={entry.execResult.exit_code === 0 ? 'text-nexus-green' : 'text-nexus-red'} />
                <span className="text-[10px] font-mono font-bold text-foreground">Execution Result</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${entry.execResult.exit_code === 0
                  ? 'bg-nexus-green/10 text-nexus-green'
                  : 'bg-nexus-red/10 text-nexus-red'
                  }`}>
                  exit {entry.execResult.exit_code}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground ml-auto">
                  {entry.execResult.duration_ms}ms
                </span>
              </div>
              {entry.execResult.stdout && (
                <div className="px-4 py-2 bg-nexus-deep/70">
                  <div className="text-[9px] font-mono text-muted-foreground mb-1">stdout</div>
                  <pre className="text-[11px] font-mono text-nexus-green whitespace-pre-wrap">{entry.execResult.stdout}</pre>
                </div>
              )}
              {entry.execResult.stderr && (
                <div className="px-4 py-2 bg-nexus-red/5">
                  <div className="text-[9px] font-mono text-muted-foreground mb-1">stderr</div>
                  <pre className="text-[11px] font-mono text-nexus-red whitespace-pre-wrap">{entry.execResult.stderr}</pre>
                </div>
              )}
            </div>
          )}

          {/* Test Results Table — Sprint D */}
          {entry.testResult && (
            <div className="border-t border-nexus-border-subtle">
              <div className="flex items-center gap-2 px-4 py-2 bg-nexus-deep">
                <FlaskConical size={11} className={entry.testResult.tests_failed === 0 ? 'text-nexus-blue' : 'text-nexus-red'} />
                <span className="text-[10px] font-mono font-bold text-foreground">Test Results</span>
                {entry.testResult.tests_passed !== undefined && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ml-1 ${(entry.testResult.tests_failed ?? 0) === 0
                    ? 'bg-nexus-green/10 text-nexus-green'
                    : 'bg-nexus-red/10 text-nexus-red'
                    }`}>
                    {entry.testResult.tests_passed} pass / {entry.testResult.tests_failed} fail
                  </span>
                )}
                <span className="text-[9px] font-mono text-muted-foreground ml-auto">
                  {entry.testResult.duration_ms}ms
                </span>
              </div>
              {entry.testResult.tests && entry.testResult.tests.length > 0 && (
                <div className="px-4 pb-2 bg-nexus-deep/60">
                  <table className="w-full text-[10px] font-mono">
                    <thead>
                      <tr className="text-muted-foreground border-b border-nexus-border-subtle/50">
                        <th className="text-left py-1 pl-1">Test</th>
                        <th className="text-left py-1">Result</th>
                        <th className="text-right py-1 pr-1">ms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.testResult.tests.map((t, ti) => (
                        <tr key={ti} className="border-b border-nexus-border-subtle/30 last:border-0">
                          <td className="py-1 pl-1 text-foreground truncate max-w-[240px]">{t.name}</td>
                          <td className="py-1">
                            {t.passed
                              ? <span className="text-nexus-green">✓ PASS</span>
                              : <span className="text-nexus-red" title={t.error}>✗ FAIL</span>
                            }
                          </td>
                          <td className="py-1 pr-1 text-right text-muted-foreground">{t.duration_ms}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {entry.testResult.stderr && (
                <div className="px-4 py-2 bg-nexus-red/5">
                  <div className="text-[9px] font-mono text-muted-foreground mb-1">stderr</div>
                  <pre className="text-[11px] font-mono text-nexus-red whitespace-pre-wrap">{entry.testResult.stderr}</pre>
                </div>
              )}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
