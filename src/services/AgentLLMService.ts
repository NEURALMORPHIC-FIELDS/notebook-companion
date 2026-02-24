/**
 * AgentLLMService — calls the agent-llm edge function for any NEXUS agent.
 * Supports both streaming (SSE) and non-streaming responses.
 */

import { loadAgentConfigs, type AgentApiConfig } from '@/data/agent-services';

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

/**
 * Get the active LLM config for a specific agent role.
 */
function getAgentConfig(agentRole: string): AgentApiConfig | null {
  const allConfigs = loadAgentConfigs();
  // Map agent roles to config keys
  const roleToKey: Record<string, string> = {
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
  
  const key = roleToKey[agentRole] || agentRole;
  const configs = allConfigs[key] || [];
  
  // Priority: custom enabled > any enabled with key > null (default)
  const custom = configs.find((c: AgentApiConfig) => c.serviceId === 'custom' && c.enabled);
  if (custom) return custom;
  const withKey = configs.find((c: AgentApiConfig) => c.enabled && c.apiKey);
  if (withKey) return withKey;
  return null;
}

/**
 * Call agent LLM with streaming, returning the full response text.
 */
export async function callAgentLLM(request: AgentLLMRequest): Promise<string> {
  const config = getAgentConfig(request.agentRole);
  
  const llmConfig = config ? {
    serviceId: config.serviceId,
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl || '',
    chatApi: config.chatApi || '',
    model: config.model || '',
  } : null;

  const resp = await fetch(AGENT_LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      agentRole: request.agentRole,
      messages: request.messages,
      phase: request.phase,
      llmConfig,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'Unknown error');
    throw new Error(`Agent LLM error (${resp.status}): ${errText}`);
  }

  if (!resp.body) throw new Error('No response body');

  // Parse SSE stream and collect full response
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') break;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) fullResponse += content;
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }

  return fullResponse;
}

/**
 * Call agent LLM with streaming, invoking onDelta for each token.
 */
export async function streamAgentLLM(
  request: AgentLLMRequest,
  onDelta: (chunk: string) => void,
  onDone: () => void,
): Promise<void> {
  const config = getAgentConfig(request.agentRole);
  
  const llmConfig = config ? {
    serviceId: config.serviceId,
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl || '',
    chatApi: config.chatApi || '',
    model: config.model || '',
  } : null;

  const resp = await fetch(AGENT_LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      agentRole: request.agentRole,
      messages: request.messages,
      phase: request.phase,
      llmConfig,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'Unknown error');
    throw new Error(`Agent LLM error (${resp.status}): ${errText}`);
  }

  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }

  onDone();
}
