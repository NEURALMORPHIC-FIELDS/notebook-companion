import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User, FileText, Loader2, Settings2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { loadAgentConfigs, type AgentApiConfig } from "@/data/agent-services";
import { parseSseStream } from "@/utils/sseParser";
import { orchestratorStore } from "@/stores/OrchestratorStore";

interface Message {
  id: number;
  role: 'user' | 'assistant';
  agent?: string;
  content: string;
  timestamp: string;
}

const PM_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pm-chat`;

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    role: 'assistant',
    agent: 'PM',
    content: 'Welcome to NEXUS AI Project Developer! I am your Project Manager agent. I will interview you first (name, users, features, style, colors, auth, data, integrations, deployment, constraints), then build a professional handoff prompt for the specialist agents.',
    timestamp: '14:30',
  },
];

function getNow() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Get the active LLM config for PM agent */
function getActivePmConfig(): AgentApiConfig | null {
  const allConfigs = loadAgentConfigs();
  const pmConfigs = allConfigs['pm'] || [];
  console.log('[PM ChatPanel] PM configs from localStorage:', JSON.stringify(pmConfigs));
  // Priority 1: Custom LLM if enabled (even without baseUrl — user may have just apiKey+model)
  const custom = pmConfigs.find(c => c.serviceId === 'custom' && c.enabled);
  if (custom) return custom;
  // Priority 2: Any other enabled service with API key
  const withKey = pmConfigs.find(c => c.enabled && c.apiKey);
  if (withKey) return withKey;
  // Priority 3: Custom fallback (defaults from agent config normalization)
  const customFallback = pmConfigs.find(c =>
    c.serviceId === 'custom' && Boolean(c.baseUrl || c.chatApi || c.model)
  );
  if (customFallback) return customFallback;
  return null; // Will use Lovable AI default
}

function getActiveLlmLabel(config: AgentApiConfig | null): string {
  if (!config) return 'Lovable AI (Gemini 3 Flash)';
  if (config.serviceId === 'custom') {
    return config.model ? `Custom: ${config.model}` : 'Custom LLM API';
  }
  const names: Record<string, string> = {
    anthropic: 'Anthropic Claude',
    gemini: 'Google Gemini',
    grok: 'xAI Grok',
  };
  return names[config.serviceId] || config.serviceId;
}

const STORAGE_KEY = 'nexus-chat-messages';

function loadSavedMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return INITIAL_MESSAGES;
}

function persistMessages(msgs: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch { /* ignore if quota exceeded */ }
}

function findStructuredStart(text: string): number {
  const patterns = [
    /\b1\)\s*PROJECT_INTENT\b/i,
    /\bPROJECT_INTENT\b/i,
  ];

  const indexes = patterns
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0);

  if (indexes.length === 0) return -1;
  return Math.min(...indexes);
}

function ensureInterviewQuestionsIfNeeded(text: string): string {
  const hasTemplate =
    /PROJECT_INTENT/i.test(text) &&
    /FAS_DRAFT/i.test(text) &&
    /ASSUMPTIONS_GAPS/i.test(text) &&
    /PROFESSIONAL_HANDOFF_PROMPT/i.test(text) &&
    /NEXT_STEP/i.test(text);

  if (!hasTemplate) return text;

  const hasQuestionMark = text.includes('?');
  if (hasQuestionMark) return text;

  return `${text}

INTERVIEW_QUESTIONS
- What is the project name and one-sentence mission?
- Who are the primary users and what problem are we solving?
- Which 3 core features are mandatory for the first version?
- What visual direction and color palette do you prefer?
- Do you need authentication and persistent storage in V1?
- Which deployment target do you prefer (local, Vercel, Netlify, custom)?`;
}

function sanitizeAssistantText(text: string): string {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/```[\s\S]*?```/g, '[Code block omitted by PM policy. Continue with architecture and handoff details.]');

  const start = findStructuredStart(cleaned);
  const structured = start >= 0 ? cleaned.slice(start) : cleaned;
  const normalized = structured.trim();
  if (!normalized) return '';
  return ensureInterviewQuestionsIfNeeded(normalized);
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(loadSavedMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeConfig, setActiveConfig] = useState<AgentApiConfig | null>(getActivePmConfig);

  useEffect(() => {
    const refresh = () => setActiveConfig(getActivePmConfig());
    window.addEventListener('nexus-agent-configs-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('nexus-agent-configs-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const llmLabel = getActiveLlmLabel(activeConfig);

  // Auto-save messages to localStorage whenever they change
  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: getNow(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    const aiMessages = updatedMessages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.id !== 1))
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    let assistantSoFar = '';
    const assistantId = Date.now() + 1;

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      const safeText = sanitizeAssistantText(assistantSoFar);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id === assistantId) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: safeText } : m);
        }
        return [...prev, { id: assistantId, role: 'assistant', agent: 'PM', content: safeText, timestamp: getNow() }];
      });
    };

    try {
      // Determine endpoint: Direct Custom LLM vs Supabase proxy
      const isCustom = activeConfig?.serviceId === 'custom' && activeConfig.baseUrl;

      let fetchUrl: string;
      let fetchHeaders: Record<string, string>;
      let fetchBody: string;

      if (isCustom) {
        // === DIRECT Custom LLM call (OpenAI-compatible) ===
        const chatEndpoint = activeConfig!.chatApi || `${activeConfig!.baseUrl}/chat/completions`;
        fetchUrl = chatEndpoint;
        fetchHeaders = { 'Content-Type': 'application/json' };
        if (activeConfig!.apiKey) {
          fetchHeaders['Authorization'] = `Bearer ${activeConfig!.apiKey}`;
        }

        const systemPrompt = {
          role: 'system',
          content: `You are NEXUS AI — PM Agent. You are connected via "${activeConfig!.model || 'custom model'}" at endpoint "${activeConfig!.baseUrl}". Your role is planning and architecture definition, not implementation.

Platform knowledge:
- NEXUS AI uses a 14-agent SDLC pipeline.
- Phase chain: 1A -> 1B -> 2 -> 3A -> 3B -> 4 -> 5 -> 6A -> 6B -> 7 -> 8 -> 9 -> 10 -> 11.
- PM handles discovery and professional handoff only.
- Specialist agents implement code in later phases.
- Autonomy mode 5 means HITL skipped and GitHub auto-commit blocked.
- Outputs are stored in Notebook; implementation artifacts can be saved as files.
- If platform capability is unknown, explicitly say unknown. Never invent features.

Rules:
- Do not generate executable code (HTML/CSS/JS/TS/Python/SQL/Bash).
- Do not output chain-of-thought or <think> tags.
- If the user asks for code, refuse implementation and continue with planning + professional handoff to the next agent.
- Be transparent about model and endpoint when asked.
- Run a discovery interview before final handoff.
- Collect at least: project name, target users, core features, visual style, color palette, auth, storage/data, integrations, deployment target, timeline, and constraints.
- Ask targeted follow-up questions when information is missing.
- If user says "you decide", make explicit assumptions and continue.
- If user asks how the platform works, answer from Platform knowledge first and then continue interview flow.

Mandatory response structure:
1) PROJECT_INTENT
2) FAS_DRAFT
3) ASSUMPTIONS_GAPS
4) PROFESSIONAL_HANDOFF_PROMPT
5) NEXT_STEP`,
        };
        fetchBody = JSON.stringify({
          model: activeConfig!.model || 'default',
          messages: [systemPrompt, ...aiMessages],
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        });

        console.log(`[PM Chat] Direct call to Custom LLM: ${chatEndpoint}`);
      } else {
        // === Supabase edge function fallback ===
        fetchUrl = PM_CHAT_URL;
        fetchHeaders = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        };
        const llmConfig = activeConfig
          ? {
            serviceId: activeConfig.serviceId,
            apiKey: activeConfig.apiKey || '',
            baseUrl: activeConfig.baseUrl || '',
            chatApi: activeConfig.chatApi || '',
            model: activeConfig.model || '',
          }
          : null;
        fetchBody = JSON.stringify({ messages: aiMessages, llmConfig });
        console.log(`[PM Chat] Supabase proxy call`);
      }

      const resp = await fetch(fetchUrl, {
        method: 'POST',
        headers: fetchHeaders,
        body: fetchBody,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${resp.status}: ${errText}`);
      }

      if (!resp.body) throw new Error('No response body received.');

      // Stream response using shared SSE parser (src/utils/sseParser.ts)
      for await (const chunk of parseSseStream(resp.body)) {
        upsert(chunk);
      }

      if (!assistantSoFar) {
        console.warn('[PM Chat] No streaming data received — response may not be SSE format.');
      }
    } catch (e) {
      console.error('PM chat error:', e);
      toast.error(e instanceof Error ? e.message : 'Error communicating with LLM');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-nexus-border-subtle px-6 py-3 flex items-center gap-3">
        <FileText size={16} className="text-primary" />
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-foreground">Project Developer</h1>
          <p className="text-[10px] text-muted-foreground font-mono">
            Agent: Project Manager • Connected to: <span className="text-primary font-bold">{llmLabel}</span>
            {activeConfig?.baseUrl && <span className="text-muted-foreground/60"> • {activeConfig.baseUrl}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-nexus-green/10 text-nexus-green text-[9px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-nexus-green animate-pulse" />
            <span>{llmLabel}</span>
          </div>
          <button
            onClick={handleClearChat}
            className="px-2 py-1 rounded-md text-[9px] font-mono text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Clear conversation"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'
              }`}>
              {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className={`max-w-[75%] rounded-lg p-3 text-sm ${msg.role === 'assistant'
              ? 'bg-card border border-nexus-border-subtle text-card-foreground'
              : 'bg-primary/15 border border-primary/20 text-foreground'
              }`}>
              {msg.agent && (
                <div className="text-[10px] font-mono text-primary mb-1">{msg.agent} Agent</div>
              )}
              <div className="whitespace-pre-wrap text-xs leading-relaxed">{msg.content}</div>
              <div className="text-[9px] text-muted-foreground mt-1.5">{msg.timestamp}</div>
            </div>
          </motion.div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/20 text-primary">
              <Loader2 size={14} className="animate-spin" />
            </div>
            <div className="bg-card border border-nexus-border-subtle rounded-lg p-3 text-xs text-muted-foreground">
              PM Agent processing...
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-nexus-border-subtle p-4 space-y-2">
        {/* Input row */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe your project, request changes, or ask which LLM powers me..."
            disabled={isLoading}
            className="flex-1 bg-muted border border-nexus-border-subtle rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="bg-primary text-primary-foreground rounded-lg px-4 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        {/* Launch NEXUS Pipeline — appears after 2+ exchanges, triggers Phase 1A */}
        {messages.length > 2 && (
          <button
            onClick={async () => {
              const spec = messages
                .filter(m => m.content.length > 20)
                .map(m => `${m.role === 'user' ? 'CLIENT' : 'PM'}: ${m.content}`)
                .join('\n\n');
              try {
                toast.info('Launching NEXUS pipeline — Phase 1A starting...', { duration: 3000 });
                await orchestratorStore.runPhaseWithLLM('1A', spec);
                toast.success('Phase 1A queued for HITL review. Check Approvals panel.');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Failed to launch pipeline');
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-nexus-green/10 text-nexus-green text-xs font-semibold border border-nexus-green/20 hover:bg-nexus-green/20 transition-colors"
          >
            <Rocket size={13} />
            Launch NEXUS Pipeline — Start Phase 1A (FAS Generation)
          </button>
        )}
      </div>
    </div>
  );
}
