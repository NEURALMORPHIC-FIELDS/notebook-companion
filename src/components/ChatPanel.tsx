import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
    content: 'Bun venit la NEXUS AI! Sunt Project Manager-ul tău. Hai să începem cu Functional Architecture Sheet (FAS). Ce vrei să facă software-ul tău?',
    timestamp: '14:30',
  },
];

function getNow() {
  return new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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

    // Build history for AI (skip initial greeting)
    const aiMessages = updatedMessages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.id !== 1))
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    let assistantSoFar = '';

    try {
      const resp = await fetch(PM_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: aiMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: 'Eroare necunoscută' }));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;
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

      while (!streamDone) {
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
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error('PM chat error:', e);
      toast.error(e instanceof Error ? e.message : 'Eroare la comunicarea cu PM Agent');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-nexus-border-subtle px-6 py-3 flex items-center gap-3">
        <FileText size={16} className="text-primary" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">FAS Conversation — Phase 1A</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Agent: Project Manager • Mode: EXPERT • LLM: Gemini 3 Flash</p>
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
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'
            }`}>
              {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className={`max-w-[75%] rounded-lg p-3 text-sm ${
              msg.role === 'assistant'
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
              PM Agent procesează...
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
            placeholder="Descrie funcționalitatea dorită..."
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
