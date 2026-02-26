# NEXUS.md — NEXUS AI v6 Ground Truth Document

> Single source of truth for project state, behavioral rules status, and phase completion.
> Updated at phase transitions and after every sprint.

**Project:** notebook-companion
**Architecture Version:** v6
**Implementation Status:** Sprint A complete (Code Executor). Sprints B–E pending.
**Last Updated:** 2026-02-25

---

## Platform Capability — Current vs Target

| Capability | Current Status | Sprint |
|------------|---------------|--------|
| PM Agent chat (FAS generation) | ✅ Connected to pipeline | — |
| 15-phase auto-sequencing (PhaseSequencer) | ✅ Implemented | — |
| 14 specialized AI agents | ✅ All active | — |
| HITL approval gate | ✅ Functional | — |
| Devil's Advocate pre-HITL | ✅ Structured parsing | — |
| Known Incomplete registry (append-only) | ✅ Functional | — |
| Agent Notebook — 4-agent LLM review | ✅ Functional | — |
| **Code Executor — real code execution** | ✅ Deno sandbox | Sprint A |
| SSE streaming (all agents) | ✅ via sseParser | — |
| Session persistence (localStorage) | ✅ Functional | — |
| Veritas (browser-side SanityGate) | ✅ Reads report | — |
| Veritas Runner (real AST analysis) | ⏳ Stub | Sprint C |
| File Writer (GitHub API) | ⏳ Not implemented | Sprint B |
| Test Runner (run QA tests) | ⏳ Not implemented | Sprint D |
| Deploy Engine (Vercel/Railway) | ⏳ Not implemented | Sprint E |

---

## Behavioral Rules — Active Status

| # | Rule | Module | Status |
|---|------|--------|--------|
| 1 | Zero Spam (Jaccard trigram) | `AgentOutputFilter` | ✅ Active |
| 2 | Ran ≠ Worked | `RanVsWorkedReporter` | ✅ Active |
| 3 | Zero Silent Failures | `SilentDropMonitor` | ✅ Active |
| 4 | Namespaced Cache | `NamespacedCache` | ✅ Active |
| 5 | OPEN/CLOSE pairs | `ArchContradictionDetector` | ✅ Active |
| 6 | FAS Contract | `VeritasGenerator` | ✅ Active |
| 7 | Calibrated Thresholds | `ThresholdCalibrationGate` | ✅ Active |
| 8 | Devil's Advocate mandatory | `DevilsAdvocateAgent` | ✅ Active |
| 9 | Sanity Gate (blocks HITL if exit_code ≠ 0) | `SanityGate` | ✅ Active |
| 10 | Known Incomplete append-only | `KnownIncompleteRegistry` | ✅ Active |

---

## Phase Completion Tracker

| Phase | Name | Agent | Veritas | DA | HITL | Status |
|-------|------|-------|---------|-----|------|--------|
| 0 | Onboarding | System | — | — | — | ✅ Complete |
| 1A | FAS Generation | PM | — | — | Required | ⏳ Pending user project |
| 1B | PRD | PM | — | — | Required | ⏳ Auto-starts after 1A |
| 2 | Team Assembly | PM | — | — | Required | ⏳ Auto-starts after 1B |
| 3A | Architecture | Architect | Required | Required | Required | ⏳ Pending |
| 3B | Brand & Design | Brand + UX | — | — | Required | ⏳ Pending |
| 4 | Technical Design | Tech Lead | — | Required | Required | ⏳ Pending |
| 5 | WBS | PM | — | — | Required | ⏳ Pending |
| 6A | Implementation Dev | Backend + Frontend | Required | — | Required | ⏳ Pending |
| 6B | Implementation Assets | Asset Gen | — | — | — | ⏳ Pending |
| 7 | Code Review | Code Reviewer | Required | Required | Required | ⏳ Pending |
| 8 | QA & Testing | QA Engineer | Required | — | Required | ⏳ Pending |
| 9 | Security Audit | Security Auditor | Required | Required | Required | ⏳ Pending |
| 10 | Documentation | Tech Writer | — | — | Required | ⏳ Pending |
| 11 | DevOps / Deploy | DevOps Engineer | Required | — | Required | ⏳ Pending |

---

## Code Executor — Sprint A

Edge function: `supabase/functions/code-executor/index.ts`
Service: `src/services/CodeExecutorService.ts`

**Modes:**
- `run` — executes TypeScript/JS, returns `stdout + stderr + exit_code + duration_ms`
- `test` — wraps code in test harness, returns `tests[] { name, passed, error, duration_ms }`

**Security parameters:**
- Timeout: 10,000ms hard kill
- Code size limit: 50KB
- Output cap: 10KB
- Permissions: NONE (`--no-prompt`, no allow flags)

**Integration:** Agent Notebook → "Execute" button (appears after review pipeline completes)

---

## Pending Sprints

| Sprint | Deliverable | Impact |
|--------|------------|--------|
| B — File Writer | Write Phase 6A code to GitHub repo | Generated code reaches real files |
| C — Real Veritas | BFS AST import traversal | Sanity Gate becomes objectively accurate |
| D — Test Runner | Execute QA-generated tests | Test verdict: pass/fail (not LLM opinion) |
| E — Deploy Engine | Trigger Vercel/Railway deploy | Pipeline terminates with live URL |

---

## Sources of Truth

| Artifact | Key |
|----------|-----|
| Project spec / FAS | `nexus-fas-draft` |
| Veritas report | `nexus-veritas-report` |
| Phase outputs (all) | `nexus-phase-outputs` |
| Session state | `nexus-session-state` |
| Known Incomplete items | `nexus-known-incomplete` |
| Orchestrator state | `nexus-orchestrator-state` |
| Notebook entries | `nexus-notebook-entries` |

---

*"Truth comes from code, not from text." — NEXUS AI v6 Core Philosophy*
