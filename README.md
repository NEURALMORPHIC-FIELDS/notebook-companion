# NEXUS AI v6 — Notebook Companion

> **Professional AI Software Development Platform** · React + Supabase · NEXUS AI v6 Architecture

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Edge_Functions-3ecf8e)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff)](https://vitejs.dev/)

---

## Vision

**A professional software company, all departments replaced by AI agents.**

The user is the client — they describe what they want in natural language. NEXUS AI v6 runs the full SDLC: from requirements gathering → architecture → implementation → code review → QA → security audit → documentation → deployment. Every phase is gated by human approval (HITL) and machine verification (Veritas).

---

## Current Implementation Status

### ✅ Implemented & Connected

| Component | Status | Notes |
|-----------|--------|-------|
| **14 AI Agents** | ✅ Active | PM, Architect, DA, TL, Backend, Frontend, QA, Security, CodeReview, TechWriter, DevOps, Brand, UX, Assets |
| **15-Phase SDLC Pipeline** | ✅ Connected | Phase 0 → 1A → ... → 11, automatic sequencing |
| **PhaseSequencer** | ✅ Active | After HITL Approve → auto-starts next phase with context-aware input |
| **HITL Panel** | ✅ Active | Known Incomplete → DA Review → Approve/Reject |
| **Devil's Advocate** | ✅ Active | Pre-HITL contestation, CRITICAL/HIGH/MEDIUM severity parsing |
| **Veritas Gate (Browser)** | ✅ Active | SanityGate reads localStorage report, blocks HITL if exit_code ≠ 0 |
| **Code Executor (Deno)** | ✅ Active | `code-executor` edge function — runs TypeScript in isolated sandbox |
| **Agent Notebook** | ✅ Active | 4-agent review pipeline (CodeReview → QA → Security → Architect) + Execute button |
| **FAS Generator** | ✅ Active | Phase 1A: PM Agent chat with OPEN/CLOSE pair validation |
| **10 Behavioral Rules** | ✅ Active | Zero Spam, Ran≠Worked, No Silent Drops, Known Incomplete, etc. |
| **Session Persistence** | ✅ Active | localStorage + Supabase DB |
| **SSE Streaming** | ✅ Active | Shared `sseParser.ts` across all components |

### ⏳ In Progress (Sprints B–E)

| Component | Sprint | Status |
|-----------|--------|--------|
| **File Writer** (GitHub API) | B | Pending |
| **Real Veritas** (AST import traversal) | C | Pending |
| **Test Runner** (run QA-generated tests) | D | Pending |
| **Deploy Engine** (Vercel/Railway) | E | Pending |

---

## How the Pipeline Works

```
1. User opens ChatPanel (PM Agent)
   └─ Describes project in natural language
   └─ "Launch NEXUS Pipeline" button appears after 2+ exchanges

2. Phase 1A — FAS Generation (PM Agent)
   └─ PM generates Functional Architecture Sheet
   └─ OPEN/CLOSE function pairs validated automatically
   └─ HITL: user reviews & approves

3. Phase 1B — PRD (PM Agent) [AUTO-STARTED after 1A approved]
   └─ FAS becomes input context
   └─ PM generates Product Requirements Document
   └─ HITL approval

4. Phase 2 → 3A → 4 → 5... [AUTO-CHAINED]
   └─ Each phase output feeds as structured context to next
   └─ Phase 3A: Architect generates ADR
   └─ Phase 4: Tech Lead generates Tech Spec
   └─ Phase 5: PM generates WBS (1 task per FAS function)

5. Phase 6A — Implementation
   └─ Backend + Frontend Engineers generate code
   └─ Code sent to Agent Notebook automatically
   └─ Notebook: 4-agent review (Code Review → QA → Security → Architect)
   └─ Execute button: runs code in Deno sandbox → stdout/stderr/exit_code
   └─ HITL approval

6. Phase 7 → 8 → 9 → 10 → 11 [AUTO-CHAINED]
   └─ Phase 8 QA: test cases generated
   └─ Phase 9 Security: OWASP audit
   └─ Phase 11 DevOps: CI/CD config generated
```

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
│  └─ Execute: code-executor edge fn → stdout/stderr/exit_code   │
└────────────────────────────────────────────────────────────────┘
```

---

## Supabase Edge Functions

| Function | Purpose | Status |
|----------|---------|--------|
| `agent-llm` | All agent LLM calls (streaming SSE) | ✅ Active |
| `pm-chat` | PM Agent direct chat endpoint | ✅ Active |
| `veritas-runner` | Module wiring analysis | 🔧 Stub (Sprint C) |
| `code-executor` | TypeScript execution in Deno sandbox | ✅ Active |
| `file-writer` | Write generated code to GitHub repo | ⏳ Sprint B |
| `deploy-trigger` | Trigger Vercel/Railway deployment | ⏳ Sprint E |

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
```

---

## Security

```bash
npm audit     # 0 vulnerabilities (as of Feb 2026)
```

Report vulnerabilities privately — do not open public issues.

---

*NEXUS AI v6 — Built to prevent every failure mode observed in AI coding systems v1–v5.*
