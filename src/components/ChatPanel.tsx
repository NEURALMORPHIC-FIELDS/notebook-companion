import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User, FileText, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { loadAgentConfigs, type AgentApiConfig } from "@/data/agent-services";
import { parseSseStream } from "@/utils/sseParser";

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
    content: 'Welcome to NEXUS AI Project Developer! I am your Project Manager agent, connected to your configured LLM engine. Describe your project and we will generate the complete architecture together.',
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
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id === assistantId) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { id: assistantId, role: 'assistant', agent: 'PM', content: assistantSoFar, timestamp: getNow() }];
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
          content: `You are the AI Project Manager of the NEXUS AI v6 platform. You are connected via "${activeConfig!.model || 'custom model'}" at endpoint "${activeConfig!.baseUrl}". You help the user define the architecture, features, and project plan. You respond clearly and in a structured way. When asked which LLM you are connected to, you openly say: model "${activeConfig!.model || 'custom'}" via Custom LLM API at URL "${activeConfig!.baseUrl}".`,
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

      {/* Input */}
      <div className="border-t border-nexus-border-subtle p-4">
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
      </div>
    </div>
  );
}
