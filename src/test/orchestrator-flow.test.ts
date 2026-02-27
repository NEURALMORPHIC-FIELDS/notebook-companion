import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/AgentLLMService", () => ({
  callAgentLLM: vi.fn(),
}));

import { callAgentLLM } from "@/services/AgentLLMService";
import { orchestratorStore } from "@/stores/OrchestratorStore";
import { loadGeneratedProgramFiles } from "@/services/GeneratedProgramFilesService";

function buildPhaseOutput(phase: string): string {
  if (phase === "1A") {
    return `# Functional Architecture Sheet

**F-001** — Collect User Preferences
- user_value: Users can define project constraints and visual style.
- system_effect: OPEN state for guided discovery and requirements capture.
- required_services: PM Interview Engine, Context Memory.
- close_pair: F-002
- dependencies: []

**F-002** — Finalize Requirements
- user_value: Users get a validated project scope and clear execution handoff.
- system_effect: CLOSE state for discovery workflow and approval handoff.
- required_services: Validation Engine, Handoff Builder.
- close_pair: F-001
- dependencies: [F-001]
`;
  }

  if (phase === "5") {
    return `# Work Breakdown Structure

T-001 -> F-001: Build guided interview flow
T-002 -> F-002: Build requirement validation and closure
T-003 -> F-003: Prepare handoff payload for implementation agent
T-004 -> F-004: Persist generated program file and expose download controls
`;
  }

  if (phase === "6A") {
    return `# Implementation

\`\`\`ts
export function renderSimpleAiNewsApp(): string {
  return [
    "<!doctype html>",
    "<html>",
    "<head><title>AI News</title></head>",
    "<body><h1>AI News Dashboard</h1></body>",
    "</html>",
  ].join("");
}
\`\`\`

The implementation includes app shell setup, feature placeholders, and export-ready structure.
`;
  }

  return `# Phase ${phase} Output

This phase produced structured artifacts with acceptance details, traceability metadata, and implementation guidance.
The output is intentionally verbose to satisfy structural validation and downstream orchestration requirements.
`;
}

async function waitFor(condition: () => boolean, timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out while waiting for orchestrator completion.");
}

describe("Orchestrator end-to-end flow", () => {
  beforeEach(() => {
    localStorage.clear();
    orchestratorStore.reset();
    orchestratorStore.setAutonomyMode(5);

    const mockedCall = vi.mocked(callAgentLLM);
    mockedCall.mockReset();
    mockedCall.mockImplementation(async (request) => {
      return buildPhaseOutput(request.phase ?? "unknown");
    });
  });

  it("runs from user input to phase 11 and persists implementation as a file artifact", async () => {
    await orchestratorStore.runPhaseWithLLM(
      "1A",
      "Build a simple AI news web application. If needed, decide missing details automatically.",
    );

    await waitFor(() => {
      const phase11 = orchestratorStore.getState().phases.find((phase) => phase.number === "11");
      return phase11?.status === "completed";
    });

    const state = orchestratorStore.getState();
    const completedPhases = state.phases.filter((phase) => phase.status === "completed");

    expect(completedPhases.length).toBeGreaterThanOrEqual(14);
    expect(state.phases.find((phase) => phase.number === "6A")?.status).toBe("completed");
    expect(state.phases.find((phase) => phase.number === "11")?.status).toBe("completed");

    const generatedFiles = loadGeneratedProgramFiles();
    expect(generatedFiles.some((file) => file.fileName === "implementation-phase-6a.ts")).toBe(true);
    expect(generatedFiles[0]?.content).toContain("```ts");
  });
});
