import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User, FileText } from "lucide-react";

interface Message {
  id: number;
  role: 'user' | 'agent';
  agent?: string;
  content: string;
  timestamp: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    role: 'agent',
    agent: 'PM',
    content: 'Bun venit la NEXUS AI! Sunt Project Manager-ul tău. Hai să începem cu Functional Architecture Sheet (FAS). Ce vrei să facă software-ul tău?',
    timestamp: '14:30',
  },
  {
    id: 2,
    role: 'user',
    content: 'Vreau un sistem de trading algorithmic care să proceseze date de piață în timp real, să genereze semnale de tranzacționare bazate pe multiple strategii, și să execute ordine automat.',
    timestamp: '14:31',
  },
  {
    id: 3,
    role: 'agent',
    agent: 'PM',
    content: `Am înțeles. Voi documenta funcțiile în FAS. Primele funcții identificate:

**F-001** — Data Ingestion
• user_value: Primesc date de piață live fără întârziere
• system_effect: [OHLCV normalizat, stocat, event emis]
• required_services: [DataProvider, Normalizer, EventBus, Storage]

**F-002** — Signal Generation  
• user_value: Sistemul analizează piața și generează semnale
• system_effect: [Features calculate, strategii evaluate, semnal emis]
• required_services: [FeatureRegistry, StrategyEngine, SignalBus]

**F-003** — Order Execution
• user_value: Ordinele se execută automat pe exchange
• system_effect: [Ordine trimis, poziție actualizată, risc verificat]
• required_services: [OMS, VenueRouter, PreTradeRisk, PortfolioTracker]
• close_pair: F-004 (Position Close)

⚠️ Am detectat: F-003 deschide o stare (poziție). Trebuie să documentăm F-004 cu condițiile exacte de închidere. Continuăm?`,
    timestamp: '14:32',
  },
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: messages.length + 1,
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...messages, newMsg]);
    setInput('');

    // Mock agent response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        role: 'agent',
        agent: 'PM',
        content: 'Am notat. Voi adăuga funcția în FAS și voi rula Architectural Contradiction Detector pentru a verifica consistența. Un moment...',
        timestamp: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
      }]);
    }, 1200);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-nexus-border-subtle px-6 py-3 flex items-center gap-3">
        <FileText size={16} className="text-primary" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">FAS Conversation — Phase 1A</h1>
          <p className="text-[10px] text-muted-foreground font-mono">Agent: Project Manager • Mode: EXPERT</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              msg.role === 'agent' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'
            }`}>
              {msg.role === 'agent' ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className={`max-w-[75%] rounded-lg p-3 text-sm ${
              msg.role === 'agent'
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
      </div>

      {/* Input */}
      <div className="border-t border-nexus-border-subtle p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Descrie funcționalitatea dorită..."
            className="flex-1 bg-muted border border-nexus-border-subtle rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={handleSend}
            className="bg-primary text-primary-foreground rounded-lg px-4 hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
