# NEXUS AI v6 — Notebook Companion

> **Professional AI Software Development Platform** · React + Supabase · NEXUS AI v6 Architecture

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Edge_Functions-3ecf8e)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff)](https://vitejs.dev/)

---

## Vision

**A professional software company, all departments replaced by AI agents.**

The user is the client — they describe what they want in natural language. NEXUS AI v6 runs the full SDLC: from requirements gathering → architecture → implementation → code review → QA → security audit → documentation → deployment. Approval is enforced by a central autonomy policy engine (modes 1–5), with machine verification (Veritas + Global Architecture Vigilance) always active.

---

## Current Implementation Status

### ✅ Implemented & Connected

| Component | Status | Notes |
|-----------|--------|-------|
| **14 AI Agents** | ✅ Active | PM, Architect, DA, TL, Backend, Frontend, QA, Security, CodeReview, TechWriter, DevOps, Brand, UX, Assets |
| **15-Phase SDLC Pipeline** | ✅ Connected | Phase 0 → 1A → ... → 11, automatic sequencing |
| **PhaseSequencer** | ✅ Active | After approval resolution (human or auto) → auto-starts next phase with context-aware input |
| **HITL Panel + Autonomy Policy Control** | ✅ Active | 5 policy modes (strict approvals → full autonomy), no extra tab |
| **Global Architecture Vigilance** | ✅ Active | Persistent structural snapshots, stale downstream detection, systemic drift guard |
| **Devil's Advocate** | ✅ Active | Pre-HITL contestation, CRITICAL/HIGH/MEDIUM severity parsing |
| **Veritas Gate (Browser)** | ✅ Active | SanityGate reads localStorage report, blocks HITL if exit_code ≠ 0 |
| **Veritas Live Run** | ✅ Active | ▶ Run Veritas button calls `veritas-runner` edge fn, replaces mock data live |
| **Code Executor (Deno)** | ✅ Active | `code-executor` edge fn — runs TypeScript in isolated sandbox (run + test modes) |
| **Agent Notebook** | ✅ Active | 4-agent review + Execute + Run Tests; 6A/6B entries start `pending`, documentation entries auto-`passed` |
| **GitHub Direct Writer + PM Auto-Commit** | ✅ Active | Browser GitHub REST API + PM auto-commit per phase (blocked in mode 5) + RepoPanel Push All fallback |
| **Deploy Engine** | ✅ Active | `deploy-trigger` edge fn + DeployPanel — Netlify/Vercel one-click deploy |
| **FAS Generator** | ✅ Active | Phase 1A: PM Agent chat with OPEN/CLOSE pair validation |
| **10 Behavioral Rules** | ✅ Active | Zero Spam, Ran≠Worked, No Silent Drops, Known Incomplete, etc. |
| **Session Persistence** | ✅ Active | localStorage + Supabase DB |
| **SSE Streaming** | ✅ Active | Shared `sseParser.ts` across all components |

---

## How the Pipeline Works

```
1. User opens ChatPanel (PM Agent)
   └─ Describes project in natural language
   └─ "Launch NEXUS Pipeline" button appears after 2+ exchanges

2. Phase 1A — FAS Generation (PM Agent)
   └─ PM generates Functional Architecture Sheet
   └─ OPEN/CLOSE function pairs validated automatically
   └─ Approval policy decides: request HITL or auto-pass

3. Phase 1B — PRD (PM Agent) [AUTO-STARTED after 1A approved]
   └─ FAS becomes input context
   └─ PM generates Product Requirements Document
   └─ Approval policy evaluates systemic/design/agent-mode constraints

4. Phase 2 → 3A → 4 → 5... [AUTO-CHAINED]
   └─ Each phase output feeds as structured context to next
   └─ Phase 3A: Architect generates ADR
   └─ Phase 4: Tech Lead generates Tech Spec
   └─ Phase 5: PM generates WBS (1 task per FAS function)

5. Phase 6A — Implementation
   └─ Backend + Frontend Engineers generate code
   └─ Code sent to Agent Notebook automatically
   └─ Notebook: 4-agent review (Code Review → QA → Security → Architect)
   └─ Execute: runs code in Deno sandbox → stdout/stderr/exit_code
   └─ Run Tests: test harness executes in Deno → PASS/FAIL table per test
   └─ Commit: PM auto-commits phase output to GitHub (if token + repo configured, except Autonomy Mode 5)
   └─ RepoPanel: optional Push All for reviewed Notebook entries
   └─ Approval policy decides HITL granularity (function / agent / systemic / design / full autonomy)

6. Phase 7 → 8 → 9 → 10 → 11 [AUTO-CHAINED]
   └─ Phase 8 QA: test cases generated (gate: blocked if tests_failed > 0)
   └─ Phase 9 Security: OWASP audit
   └─ Phase 11 DevOps: CI/CD config + DeployPanel auto-triggers deploy hook
```

---

## Autonomy Modes (Central Approval Policy Engine)

| Mode | Behavior |
|------|----------|
| **1 — Strict per implementation** | Requires approval per implementation unit (function-level for coding phases). |
| **2 — One approval per agent** | Each agent is approved once; next outputs from that agent auto-pass. |
| **3 — Systemic changes only** | Requests approval only when global architecture vigilance detects systemic impact. |
| **4 — Design only** | Requests approval only for design outputs (brand/UI/visual flows). |
| **5 — Full autonomy** | No HITL requests; orchestrator runs end-to-end; PM GitHub auto-commit is blocked. |

---

## Architecture Overview

```
┌─────────────────── NEXUS AI v6 Platform ──────────────────────┐
│                                                                │
│  ChatPanel (PM Chat)  ──[Launch]──▶  OrchestratorStore        │
│                                         │                      │
│                                    PhaseSequencer             │
│                                    Phase N approved            │
│                                         │ auto-starts N+1     │
│                                    runPhaseWithLLM()          │
│                                         │                      │
│                              ┌──────────▼──────────┐          │
│                              │   AgentOrchestrator  │          │
│                              │  (15 phases, 14 agents)│        │
│                              └──────────┬──────────┘          │
│                                         │                      │
│              ┌──────────────────────────┤                      │
│              ▼                          ▼                      │
│        SanityGate              DevilsAdvocateAgent             │
│     (Veritas check)            (CRITICAL/HIGH/MEDIUM)          │
│              │                          │                      │
│              └───────────┬──────────────┘                      │
│                          ▼                                     │
│                    HITLManager                                 │
│              ┌─────────────────────┐                           │
│              │  KnownIncomplete    │                           │
│              │  DA Contestation    │                           │
│              │  Approve / Reject   │                           │
│              └─────────────────────┘                           │
│                          │ APPROVED                            │
│                          ▼                                     │
│                   PhaseSequencer.onApproved()                  │
│                   → next phase auto-starts                     │
│                                                                │
│  Agent Notebook (Phase 6A output)                             │
│  ├─ LLM Review: CodeReview → QA → Security → Architect         │
│  ├─ Execute: code-executor edge fn → stdout/stderr/exit_code   │
│  ├─ Run Tests: Deno test harness → PASS/FAIL table             │
│  └─ Commit: PM auto-commit (GitHub REST API)                   │
│                                                                │
│  Deploy Panel (Phase 11 complete)                              │
│  └─ deploy-trigger edge fn → Netlify / Vercel                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Control Layer (Global Coherence)

- **GlobalArchitectureVigilance** records structural snapshots per phase and marks downstream phases as stale after upstream changes.
- **Autonomy Policy Engine** is integrated in `OrchestratorStore` (`runPhaseWithLLM`, `requestApproval`, `resolveApproval`), not as an external add-on.
- **Mode 5 Safety Rule:** orchestration remains autonomous, while GitHub auto-commit is intentionally disabled.

---

## Supabase Edge Functions

| Function | Purpose | Status |
|----------|---------|--------|
| `agent-llm` | All agent LLM calls (streaming SSE) | ✅ Active |
| `pm-chat` | PM Agent direct chat endpoint | ✅ Active |
| `veritas-runner` | Module wiring analysis (live from Veritas panel) | ✅ Active |
| `code-executor` | TypeScript/JS execution in Deno sandbox | ✅ Active |
| `deploy-trigger` | Trigger Netlify/Vercel deployment | ✅ Active |

---

## Agent Roster

| Agent | Phases | Model (default) |
|-------|--------|----------------|
| Project Manager | 1A, 1B, 2, 5, 12 | Claude Opus 4 |
| Architect | 3A | Claude Opus 4 |
| **Devil's Advocate** | All DA phases | Claude Sonnet 4 |
| Tech Lead | 4 | Claude Opus 4 |
| Backend Engineer | 6A | Claude Sonnet 4 |
| Frontend Engineer | 6A | Claude Sonnet 4 |
| QA Engineer | 8 | Gemini 1.5 Pro |
| Security Auditor | 9 | Claude Opus 4 |
| Code Reviewer | 7 | Claude Sonnet 4 |
| Tech Writer | 10 | Gemini 1.5 Pro |
| DevOps Engineer | 11 | Claude Sonnet 4 |
| Brand Designer | 3B | Gemini Flash |
| UI/UX Designer | 3B | Gemini Flash |
| Asset Generator | 6B | Gemini Flash |

---

## 10 Behavioral Rules (v6)

| Rule | Enforcement |
|------|------------|
| **#1 Zero Spam** — silent when nothing new | `AgentOutputFilter` (Jaccard trigram similarity) |
| **#2 Ran ≠ Worked** — execution ≠ correctness | `RanVsWorkedReporter` |
| **#3 Zero Silent Failures** — every drop tracked | `SilentDropMonitor` |
| **#4 Namespaced Cache** — per context, never global | `NamespacedCache` |
| **#5 Every OPEN has CLOSE** — state contract | `ArchContradictionDetector` |
| **#6 FAS Contract** — architecture is binding | `VeritasGenerator` |
| **#7 Calibrated Thresholds** — no magic constants | `ThresholdCalibrationGate` |
| **#8 Devil's Advocate** — mandatory pre-HITL contestation | `DevilsAdvocateAgent` |
| **#9 Veritas Gate** — blocks HITL if exit_code ≠ 0 | `SanityGate` |
| **#10 Known Incomplete** — append-only, evidence required to resolve | `KnownIncompleteRegistry` |

---

## Getting Started

### Prerequisites
- Node.js 18+ / npm
- Supabase account
- At least one LLM API key (Anthropic Claude recommended)

### Setup

```bash
git clone https://github.com/NEURALMORPHIC-FIELDS/notebook-companion.git
cd notebook-companion
npm install
cp .env.example .env.local
```

`.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Custom LLM Defaults (Agent Config)

The **Custom LLM API** option is preloaded with these defaults:

```text
BASE URL: https://hawaii-rock-unlike-acute.trycloudflare.com/v1
CHAT API: https://hawaii-rock-unlike-acute.trycloudflare.com/v1/chat/completions
MODEL:    deepseek-ai/DeepSeek-R1-Distill-Qwen-32B
```

- The user can still edit these values in the UI at any time.
- Legacy saved endpoints are auto-migrated to the current defaults.

### Development

```bash
npm run dev       # Vite dev server
npm run lint      # ESLint
npx supabase start  # Local Supabase (optional)
```

### Deploy Edge Functions

```bash
npx supabase functions deploy agent-llm
npx supabase functions deploy pm-chat
npx supabase functions deploy code-executor
npx supabase functions deploy veritas-runner
npx supabase functions deploy deploy-trigger
```

---

## Security

```bash
npm audit     # 0 vulnerabilities (as of Feb 2026)
```

Report vulnerabilities privately — do not open public issues.

---

*NEXUS AI v6 — Built to prevent every failure mode observed in AI coding systems v1–v5.*
