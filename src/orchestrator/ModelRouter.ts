/**
 * ModelRouter.ts — Dynamic model selection per agent and task type
 * NEXUS AI v6 — Orchestrator (§11 ARCHITECTURE.md)
 *
 * "ModelRouter — Dynamic model selection per task." — ARCHITECTURE.md §11
 *
 * Routing logic per ARCHITECTURE.md §12 Supported Providers:
 *   Architecture & Security → Claude Opus (highest reasoning)
 *   Code generation        → Claude Sonnet / GPT-4o
 *   Large context (>100K)  → Gemini 1.5 Pro (1M token context)
 *   Cost-sensitive tasks   → Gemini Flash / DeepSeek
 *   Documentation          → Claude Sonnet
 *
 * The router respects user-configured API keys: if the user has configured
 * a specific model for an agent in Settings, that always takes priority.
 */

import { loadAgentConfigs } from '@/data/agent-services';

export type TaskType = 'architecture' | 'code' | 'review' | 'security' | 'documentation' | 'simple';

export interface ModelSelection {
    model: string;
    provider: 'anthropic' | 'openai' | 'gemini' | 'mistral' | 'deepseek' | 'ollama' | 'custom';
    reason: string;
    estimatedCostTier: 'high' | 'medium' | 'low';
}

// ── Routing tables (per ARCHITECTURE.md §12) ─────────────────────────────────

// Agent roles that require highest reasoning capability
const HIGH_REASONING_ROLES = new Set([
    'architect',
    'devils-advocate',
    'security-auditor',
    'tech-lead',
]);

// Agent roles optimized for code generation
const CODE_ROLES = new Set([
    'backend-engineer',
    'frontend-engineer',
    'devops-engineer',
]);

// Agent roles for documentation and content
const DOC_ROLES = new Set([
    'tech-writer',
    'brand-designer',
]);

export class ModelRouter {
    /**
     * Select the optimal model for a given agent role and task type.
     * User-configured models always take priority over automatic selection.
     *
     * @param agentRole   The agent's role identifier
     * @param taskType    Category of task being performed
     * @param contextSize Estimated token count for context window requirements
     */
    public selectModel(
        agentRole: string,
        taskType: TaskType,
        contextSize = 0,
    ): ModelSelection {
        // Check user-configured model first (Settings → Agent Config)
        const userConfig = this.getUserConfiguredModel(agentRole);
        if (userConfig) {
            return {
                model: userConfig.model,
                provider: userConfig.provider,
                reason: `User-configured model for ${agentRole}`,
                estimatedCostTier: 'medium',
            };
        }

        // Large context → Gemini 1.5 Pro (1M token window)
        if (contextSize > 100_000) {
            return {
                model: 'gemini-1.5-pro',
                provider: 'gemini',
                reason: `Context size ${contextSize.toLocaleString()} tokens exceeds standard window. Gemini 1.5 Pro selected (1M context).`,
                estimatedCostTier: 'medium',
            };
        }

        // Architecture, Security, Devil's Advocate → highest reasoning
        if (HIGH_REASONING_ROLES.has(agentRole) || taskType === 'architecture' || taskType === 'security') {
            return {
                model: 'claude-opus-4',
                provider: 'anthropic',
                reason: `High-reasoning task (${taskType}) for ${agentRole}. Claude Opus selected per ARCHITECTURE.md §12.`,
                estimatedCostTier: 'high',
            };
        }

        // Code generation
        if (CODE_ROLES.has(agentRole) || taskType === 'code') {
            return {
                model: 'claude-sonnet-4-20250514',
                provider: 'anthropic',
                reason: `Code generation task for ${agentRole}. Claude Sonnet selected.`,
                estimatedCostTier: 'medium',
            };
        }

        // Documentation
        if (DOC_ROLES.has(agentRole) || taskType === 'documentation') {
            return {
                model: 'gemini-1.5-pro',
                provider: 'gemini',
                reason: `Documentation task for ${agentRole}. Gemini 1.5 Pro selected (large context + coherence).`,
                estimatedCostTier: 'medium',
            };
        }

        // Simple tasks → cost-effective
        if (taskType === 'simple') {
            return {
                model: 'gemini-2.0-flash',
                provider: 'gemini',
                reason: `Simple task. Gemini Flash selected for cost efficiency.`,
                estimatedCostTier: 'low',
            };
        }

        // Default: Claude Sonnet (best general-purpose balance)
        return {
            model: 'claude-sonnet-4-20250514',
            provider: 'anthropic',
            reason: `Default selection: Claude Sonnet (general-purpose, high quality).`,
            estimatedCostTier: 'medium',
        };
    }

    private getUserConfiguredModel(
        agentRole: string,
    ): { model: string; provider: ModelSelection['provider'] } | null {
        try {
            const configs = loadAgentConfigs();
            const roleMap: Record<string, string> = {
                'project-manager': 'pm',
                'architect': 'architect',
                'devils-advocate': 'da',
                'tech-lead': 'techlead',
                'backend-engineer': 'backend',
                'frontend-engineer': 'frontend',
            };
            const key = roleMap[agentRole] ?? agentRole;
            const agentConfigs = configs[key] ?? [];
            const enabled = agentConfigs.find((c: { enabled: boolean; model?: string }) => c.enabled && c.model);
            if (enabled?.model) {
                return { model: enabled.model, provider: 'custom' };
            }
        } catch {
            // Config not available
        }
        return null;
    }
}
