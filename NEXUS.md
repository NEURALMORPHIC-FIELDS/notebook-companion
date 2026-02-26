# NEXUS.md — NEXUS AI v6 Ground Truth Document

> Single source of truth for project state, behavioral rules status, and phase completion.
> Updated at phase transitions and after every sprint.

**Project:** notebook-companion
**Architecture Version:** v6
**Implementation Status:** ✅ All Sprints A–E complete — full pipeline implemented.
**Last Updated:** 2026-02-26

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
| **Veritas Live Run Button** | ✅ Calls veritas-runner edge fn | Sprint C |
| **File Writer (GitHub API)** | ✅ `file-writer` edge fn + RepoPanel | Sprint B |
| **Test Runner** | ✅ Run Tests button + result table in Notebook | Sprint D |
| **Deploy Engine** | ✅ `deploy-trigger` edge fn + DeployPanel | Sprint E |

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

## Sprints Implementation Summary

### Sprint A — Code Executor
Edge fn: `supabase/functions/code-executor/index.ts` · Service: `src/services/CodeExecutorService.ts`
- Modes: `run` (stdout/stderr/exit_code) · `test` (harness with pass/fail per test)
- 10s timeout · 50KB code limit · 10KB output cap · Zero Deno permissions
- UI: **Execute** + **Run Tests** buttons in Agent Notebook (after review pipeline)

### Sprint B — GitHub File Writer
Edge fn: `supabase/functions/file-writer/index.ts` · Service: `src/services/FileWriterService.ts`
- GitHub REST API `PUT /repos/{owner}/{repo}/contents/{path}` — create or update
- Auto-detects existing file SHA for updates · Base64-encodes content
- UI: **GitHub Repo** panel — config form (owner/repo/branch/PAT) + commit history log

### Sprint C — Veritas Live Run Button
Component: `src/components/VeritasDashboard.tsx`
- **▶ Run Veritas** button calls `veritas-runner` edge fn
- Replaces static `MOCK_MODULES` with live JSON result
- Updates `orchestratorStore.setVeritasExitCode()` + shows **LIVE DATA** badge

### Sprint D — Test Runner
Component: `src/components/NotebookPanel.tsx`
- **🧪 Run Tests** button (after review pipeline) calls `runTests()` from CodeExecutorService
- Test results table: test name · ✓ PASS / ✗ FAIL · duration ms
- OrchestratorStore: Phase 8 advance blocked if `tests_failed > 0`

### Sprint E — Deploy Engine
Edge fn: `supabase/functions/deploy-trigger/index.ts` · Service: `src/services/DeployService.ts`
- POSTs to Netlify or Vercel deploy hook URL
- UI: **Deploy** panel — provider selector, hook URL, 🚀 Deploy Now, Phase 11 gate badge
- Auto-triggers when Phase 11 completes (if hook configured)

---

## Sources of Truth

| Artifact | localStorage Key |
|----------|------------------|
| Project spec / FAS | `nexus-fas-draft` |
| Veritas report | `nexus-veritas-report` |
| Phase outputs (all) | `nexus-phase-outputs` |
| Session state | `nexus-session-state` |
| Known Incomplete items | `nexus-known-incomplete` |
| Orchestrator state | `nexus-orchestrator-state` |
| Notebook entries | `nexus-notebook-entries` |
| GitHub repo config | `nexus-repo-config` |
| Committed files log | `nexus-committed-files` |
| Deploy config | `nexus-deploy-config` |
| Deploy log | `nexus-deploy-log` |

---

*"Truth comes from code, not from text." — NEXUS AI v6 Core Philosophy*
