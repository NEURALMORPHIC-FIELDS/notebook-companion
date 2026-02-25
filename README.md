# NEXUS AI v6 — Notebook Companion

> **Intelligent Software Development Platform** · VS Code Extension + Web App · Built on NEXUS AI v6 Architecture

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Edge_Functions-3ecf8e)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff)](https://vitejs.dev/)

---

## Overview

NEXUS AI v6 Notebook Companion is a multi-agent AI development platform that guides software projects through a **15-phase SDLC** using specialized AI agents, a Veritas Ground Truth verification system, and enforced behavioral rules that address production failures observed in previous AI coding systems.

**Key differentiator:** Agents are held accountable to what they actually deliver, not just what they claim to deliver.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEXUS AI v6 SDLC Flow                       │
│                                                                 │
│  Phase 0     Phase 1A    Phase 1B    Phase 2     ...            │
│  Onboarding  FAS Gen     PRD         Team        15 phases      │
│  PM Agent    PM Agent    PM Agent    PM Agent     total         │
│      │           │                                              │
│   VeritasGenerator  ──►  veritas-runner (Supabase Edge Fn)     │
│      │                        │                                  │
│   SanityGate  ◄── veritas-report.json (localStorage)           │
│      │           (exit_code 0 = WIRED, 1 = BLOCKED)            │
│      │                                                          │
│   Devil's     ──►  Structured CRITICAL/HIGH/MEDIUM output       │
│   Advocate        blocksApproval = line-start parse only        │
│      │                                                          │
│   HITL Panel  ──►  Known Incomplete (first) → DA → Approve     │
└─────────────────────────────────────────────────────────────────┘
```

---

## NEXUS AI v6 Behavioral Rules

| # | Rule | Implementation |
|---|------|----------------|
| 1 | **Zero Spam** — agents are silent when they have nothing new to say | `AgentOutputFilter` (Jaccard trigram similarity) |
| 2 | **Ran ≠ Worked** — execution report ≠ correctness report | `RanVsWorkedReporter` |
| 3 | **Zero Silent Failures** — every drop is tracked | `SilentDropMonitor` |
| 4 | **Namespaced Cache** — never global, always per context | `NamespacedCache` |
| 5 | **Every OPEN has CLOSE** — state management contract | `ArchContradictionDetector` |
| 6 | **FAS Contract** — architecture is a binding contract | `VeritasGenerator` |
| 7 | **Calibrated Thresholds** — no magic constants | `ThresholdCalibrationGate` |
| 8 | **Devil's Advocate** — mandatory pre-HITL contestation | `DevilsAdvocateAgent` |
| 9 | **Veritas Gate** — Sanity Gate blocks HITL if exit_code ≠ 0 | `SanityGate` |
| 10 | **Known Incomplete** — append-only, mandatory evidence for resolution | `KnownIncompleteRegistry` |

---

## Agent Roster (14 agents)

| Agent | Role | Key Phase |
|-------|------|-----------|
| Project Manager | FAS generation, WBS, Onboarding | 0, 1A, 1B, 2, 5, 12 |
| Architect | ADR, System Design | 3A |
| **Devil's Advocate** | Pre-HITL contestation *(generates nothing)* | All DA phases |
| Tech Lead | Technical Specification | 4 |
| Backend Engineer | Server, API, DB | 6A |
| Frontend Engineer | UI, Components | 6A |
| QA Engineer | Test plan, Test cases | 8 |
| Security Auditor | OWASP audit | 9 |
| Code Reviewer | Code quality, static analysis | 7 |
| Tech Writer | Documentation | 10 |
| DevOps Engineer | CI/CD, Infrastructure | 11 |
| Brand Designer | Visual identity | 3B |
| UI/UX Designer | Design system | 3B |
| Asset Generator | Images, Icons | 6B |

---

## Project Structure

```
src/
├── agents/              # 15 agent implementations
│   ├── BaseAgent.ts         # Template method + OutputFilter integration
│   ├── ProjectManagerAgent.ts
│   ├── DevilsAdvocateAgent.ts
│   └── ...
├── veritas/             # Veritas Ground Truth System
│   ├── VeritasGenerator.ts      # Derives CRITICAL_MODULES from FAS
│   ├── VeritasRunner.ts         # Calls veritas-runner edge function
│   ├── SanityGate.ts            # Blocks HITL if exit_code ≠ 0
│   ├── SemanticStateTracker.ts  # Module state classification
│   └── ThresholdCalibrationGate.ts
├── behavioral/          # Behavioral rules enforcement
│   ├── AgentOutputFilter.ts     # Rule #1: Zero Spam (Jaccard similarity)
│   ├── KnownIncompleteRegistry.ts  # Rule #10: Append-only registry
│   ├── ArchContradictionDetector.ts  # Rule #5: OPEN/CLOSE pairs
│   ├── NamespacedCache.ts       # Rule #4: Cache isolation
│   ├── SilentDropMonitor.ts     # Rule #3: No silent failures
│   └── RanVsWorkedReporter.ts   # Rule #2: Ran ≠ Worked
├── orchestrator/        # 15-phase SDLC orchestration
│   ├── AgentOrchestrator.ts     # Phase execution engine
│   └── ModelRouter.ts           # Dynamic model selection
├── hitl/                # Human-In-The-Loop
│   ├── HITLManager.ts           # Approval gate controller
│   └── ApprovalRequest.ts
├── adapters/            # LLM provider adapters
│   ├── AnthropicAdapter.ts
│   ├── GeminiAdapter.ts
│   └── BaseLLMAdapter.ts
├── memory/
│   └── SessionManager.ts        # Browser-safe (localStorage)
├── observability/
│   ├── StructuredLogger.ts
│   └── PhaseTracer.ts
├── utils/
│   └── sseParser.ts             # Shared SSE stream parser (DRY)
├── components/          # React UI panels
│   ├── ChatPanel.tsx            # PM Agent chat
│   ├── FASChatPanel.tsx         # Phase 1A: FAS generation chat
│   ├── NotebookPanel.tsx        # Agent code sandbox + 4-agent review
│   ├── KnownIncompletePanel.tsx # HITL first section: Known Incomplete
│   ├── ContestationPanel.tsx    # DA review with severity badges
│   └── ...
└── stores/
    └── OrchestratorStore.ts     # Reactive bridge: orchestrator → React

supabase/
└── functions/
    ├── agent-llm/               # Main LLM proxy edge function
    ├── pm-chat/                 # PM chat direct endpoint
    └── veritas-runner/          # Module wiring analysis engine
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account + project
- At least one LLM API key (Anthropic, Google Gemini, or custom OpenAI-compatible endpoint)

### Setup

```bash
git clone <repo-url>
cd notebook-companion
npm install
cp .env.example .env.local
```

Set the following in `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Development

```bash
npm run dev          # Start Vite dev server
npm run lint         # ESLint
npm run test         # Vitest
npx supabase start   # Local Supabase (optional)
```

### Deploy Supabase Edge Functions

```bash
npx supabase functions deploy agent-llm
npx supabase functions deploy pm-chat
npx supabase functions deploy veritas-runner
```

---

## LLM Configuration

Configure API keys per agent in the Settings panel:
- **Anthropic Claude** — Claude Opus 4 (architecture/security), Claude Sonnet 4 (code)
- **Google Gemini** — Gemini 1.5 Pro (large context), Gemini Flash (simple tasks)
- **Custom OpenAI-compatible** — any endpoint (Ollama, LM Studio, etc.)

ModelRouter automatically selects the optimal model per task type when no override is configured.

---

## NEXUS AI v6 Phase Flow

```
Phase 0   Onboarding — Template setup + NEXUS.md generation
Phase 1A  FAS Generation — Functional Architecture Sheet
Phase 1B  PRD — Product Requirements Document
Phase 2   Team Assembly — Agent configuration
Phase 3A  Architecture — ADR + Component Specs [Veritas + DA + HITL]
Phase 3B  Brand & Design System [HITL]
Phase 4   Technical Design — Tech Spec [DA + HITL]
Phase 5   WBS — 1 task per FAS function [HITL]
Phase 6A  Implementation — Backend + Frontend [Veritas + HITL]
Phase 6B  Asset Generation
Phase 7   Code Review [Veritas + DA + HITL]
Phase 8   QA & Testing [Veritas + HITL]
Phase 9   Security Audit [Veritas + DA + HITL]
Phase 10  Documentation [HITL]
Phase 11  DevOps & Deploy [Veritas + HITL]
```

---

## Security

Known vulnerabilities can be resolved with:
```bash
npm audit fix
```

Report security issues via the project's issue tracker (do not publicly disclose).

---

## License

MIT — see [LICENSE](LICENSE)

---

*NEXUS AI v6 Architecture — Engineered to prevent the production failures of AI coding systems v1–v5.*
