/**
 * AgentLLMService.ts — Unified LLM gateway for all NEXUS AI agents
 * NEXUS AI v6
 *
 * Routes agent requests to the `agent-llm` Supabase Edge Function.
 * Supports both full-response collection and streaming delta callbacks.
 *
 * SSE parsing is delegated to src/utils/sseParser.ts (single source of truth).
 */

import { loadAgentConfigs, type AgentApiConfig } from '@/data/agent-services';
import { parseSseStream, collectSseStream } from '@/utils/sseParser';

const AGENT_LLM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-llm`;

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentLLMRequest {
  agentRole: string;
  messages: AgentMessage[];
  phase?: string;
}

// ── Config resolution ────────────────────────────────────────────────────────

const ROLE_TO_CONFIG_KEY: Record<string, string> = {
  'project-manager': 'pm',
  'architect': 'architect',
  'devils-advocate': 'da',
  'tech-lead': 'techlead',
  'backend-engineer': 'backend',
  'frontend-engineer': 'frontend',
  'qa-engineer': 'qa',
  'security-auditor': 'security',
  'code-reviewer': 'codereviewer',
  'tech-writer': 'techwriter',
  'devops-engineer': 'devops',
  'brand-designer': 'brand',
  'uiux-designer': 'uiux',
  'asset-generator': 'assetgen',
};

function getAgentConfig(agentRole: string): AgentApiConfig | null {
  const allConfigs = loadAgentConfigs();
  const key = ROLE_TO_CONFIG_KEY[agentRole] ?? agentRole;
  const configs: AgentApiConfig[] = allConfigs[key] ?? [];

  // Priority: custom enabled > any enabled with key > null (Lovable default)
  const custom = configs.find(c => c.serviceId === 'custom' && c.enabled);
  if (custom) return custom;
  const withKey = configs.find(c => c.enabled && c.apiKey);
  return withKey ?? null;
}

function buildLLMConfig(config: AgentApiConfig | null) {
  if (!config) return null;
  return {
    serviceId: config.serviceId,
    apiKey: config.apiKey ?? '',
    baseUrl: config.baseUrl ?? '',
    chatApi: config.chatApi ?? '',
    model: config.model ?? '',
  };
}

function buildFetchOptions(request: AgentLLMRequest) {
  const config = getAgentConfig(request.agentRole);
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      agentRole: request.agentRole,
      messages: request.messages,
      phase: request.phase,
      llmConfig: buildLLMConfig(config),
    }),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Call agent LLM and collect the full response as a string.
 * Uses SSE streaming internally for efficiency.
 */
export async function callAgentLLM(request: AgentLLMRequest): Promise<string> {
  const resp = await fetch(AGENT_LLM_URL, buildFetchOptions(request));

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'Unknown error');
    throw new Error(`Agent LLM error (${resp.status}): ${errText}`);
  }
  if (!resp.body) throw new Error('No response body received from agent-llm.');

  return collectSseStream(resp.body);
}

/**
 * Stream agent LLM response, invoking onDelta for each text chunk.
 * onDone is called when the stream completes.
 */
export async function streamAgentLLM(
  request: AgentLLMRequest,
  onDelta: (chunk: string) => void,
  onDone: () => void,
): Promise<void> {
  const resp = await fetch(AGENT_LLM_URL, buildFetchOptions(request));

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'Unknown error');
    throw new Error(`Agent LLM error (${resp.status}): ${errText}`);
  }
  if (!resp.body) throw new Error('No response body received from agent-llm.');

  for await (const chunk of parseSseStream(resp.body)) {
    onDelta(chunk);
  }
  onDone();
}
