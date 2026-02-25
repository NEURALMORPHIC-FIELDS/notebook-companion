/**
 * FASChatPanel.tsx — Interactive FAS generation chat with PM Agent
 * NEXUS AI v6 — Phase 1A: Functional Architecture Sheet (§5 ARCHITECTURE.md)
 *
 * ARCHITECTURE.md §5:
 *   "Phase 1A: FAS is the contract. Every function has: user_value, system_effect
 *    (OPEN/CLOSE/NEUTRAL), required_services, close_pair (mandatory for OPEN),
 *    verification_mechanism, priority, constraints."
 *
 * ARCHITECTURE.md §7:
 *   "Every OPEN function must have a documented CLOSE counterpart.
 *    PM blocks phase completion until all OPEN/CLOSE pairs are matched."
 *
 * Features:
 *   - Chat with PM Agent to iteratively build the FAS
 *   - Auto-detects OPEN functions without CLOSE pairs in the response
 *   - Displays OPEN/CLOSE pair validation warnings
 *   - Saves FAS to localStorage when the PM outputs a valid FAS block
 */

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User, FileCode, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { parseSseStream } from "@/utils/sseParser";

const PM_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pm-chat`;
const FAS_STORAGE_KEY = 'nexus-fas-draft';

interface FASMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    openPairsWarning?: string[];    // OPEN functions without CLOSE
}

interface ValidationResult {
    openWithoutClose: string[];     // Function IDs with OPEN effect but no close_pair
    hasPairs: boolean;
}

function getNow() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Detect OPEN/CLOSE pair violations in PM output */
function validateFASPairs(content: string): ValidationResult {
    const openFunctions: string[] = [];
    const closePairs = new Set<string>();

    // Look for function definitions with system_effect: OPEN
    const openMatches = content.matchAll(/\*\*(F-\d+)\*\*[^•]*•\s*system_effect:\s*\[?OPEN/gi);
    for (const match of openMatches) {
        openFunctions.push(match[1]);
    }

    // Look for close_pair declarations
    const closeMatches = content.matchAll(/close_pair:\s*(F-\d+)/gi);
    for (const match of closeMatches) {
        closePairs.add(match[1]);
    }

    const openWithoutClose = openFunctions.filter(fnId => !closePairs.has(fnId));
    return { openWithoutClose, hasPairs: openWithoutClose.length === 0 };
}

const INITIAL_MESSAGES: FASMessage[] = [
    {
        id: 1,
        role: 'assistant',
        content: `# FAS Generation — Phase 1A

Welcome! I am the PM Agent for NEXUS AI v6. Let's generate your Functional Architecture Sheet (FAS).

**Tell me about your project** and I will generate:
- Functions with OPEN/CLOSE/NEUTRAL effects
- Required services per function
- Verification mechanisms
- Priority classifications

> Every OPEN function will have a mandatory CLOSE counterpart. I will flag any missing pairs.

What are you building?`,
        timestamp: getNow(),
    },
];

export default function FASChatPanel() {
    const [messages, setMessages] = useState<FASMessage[]>(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [savedFAS, setSavedFAS] = useState<string | null>(() => localStorage.getItem(FAS_STORAGE_KEY));
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: FASMessage = { id: Date.now(), role: 'user', content: input, timestamp: getNow() };
        const history = [...messages, userMsg];
        setMessages(history);
        setInput('');
        setIsLoading(true);

        const aiMessages = history
            .filter(m => m.id !== 1)
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        let assistantContent = '';
        const assistantId = Date.now() + 1;

        try {
            const resp = await fetch(PM_CHAT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: JSON.stringify({
                    messages: aiMessages,
                    systemPrompt: 'You are the PM Agent generating a Functional Architecture Sheet (FAS) for NEXUS AI v6. For every OPEN function, you MUST provide a close_pair. Use the exact FAS format: **F-XXX** — Name, bullet points for user_value, system_effect [OPEN/CLOSE/NEUTRAL], required_services, close_pair, verification_mechanism, priority, constraints.',
                }),
            });

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            if (!resp.body) throw new Error('No response body.');

            for await (const chunk of parseSseStream(resp.body)) {
                assistantContent += chunk;
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.role === 'assistant' && last.id === assistantId) {
                        return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                    }
                    return [...prev, { id: assistantId, role: 'assistant', content: assistantContent, timestamp: getNow() }];
                });
            }

            // Validate OPEN/CLOSE pairs after streaming completes
            const validation = validateFASPairs(assistantContent);
            if (validation.openWithoutClose.length > 0) {
                setMessages(prev => prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, openPairsWarning: validation.openWithoutClose } : m
                ));
                toast.warning(`${validation.openWithoutClose.length} OPEN function(s) missing CLOSE pair: ${validation.openWithoutClose.join(', ')}`);
            } else if (assistantContent.includes('F-0') && validation.hasPairs) {
                // Save FAS draft to localStorage
                localStorage.setItem(FAS_STORAGE_KEY, assistantContent);
                setSavedFAS(assistantContent);
                toast.success('FAS draft saved — all OPEN/CLOSE pairs validated.');
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Error communicating with PM Agent');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="border-b border-nexus-border-subtle px-6 py-3 flex items-center gap-3">
                <FileCode size={16} className="text-primary" />
                <div className="flex-1">
                    <h1 className="text-sm font-semibold text-foreground">FAS Generator — Phase 1A</h1>
                    <p className="text-[10px] text-muted-foreground font-mono">
                        Agent: PM · Output: Functional Architecture Sheet · Rule: Every OPEN needs a CLOSE
                    </p>
                </div>
                {savedFAS && (
                    <span className="flex items-center gap-1 text-[9px] font-mono text-nexus-green bg-nexus-green/10 px-2 py-0.5 rounded">
                        <CheckCircle2 size={9} /> FAS Draft Saved
                    </span>
                )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
                {messages.map((msg, i) => (
                    <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                            {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                        </div>
                        <div className={`max-w-[80%] rounded-lg p-3 text-xs ${msg.role === 'assistant' ? 'bg-card border border-nexus-border-subtle' : 'bg-primary/15 border border-primary/20'}`}>
                            {msg.role === 'assistant' && <div className="text-[10px] font-mono text-primary mb-1">PM Agent</div>}
                            <div className="whitespace-pre-wrap leading-relaxed text-foreground">{msg.content}</div>
                            {/* OPEN/CLOSE validation warning */}
                            {msg.openPairsWarning && msg.openPairsWarning.length > 0 && (
                                <div className="mt-2 flex items-start gap-1.5 p-2 rounded bg-nexus-amber/10 border border-nexus-amber/30">
                                    <AlertTriangle size={11} className="text-nexus-amber mt-0.5 flex-shrink-0" />
                                    <p className="text-[10px] text-nexus-amber">
                                        OPEN without CLOSE: {msg.openPairsWarning.join(', ')}. Ask PM to add close_pair for each.
                                    </p>
                                </div>
                            )}
                            <div className="text-[9px] text-muted-foreground mt-1.5">{msg.timestamp}</div>
                        </div>
                    </motion.div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/20 text-primary">
                            <Loader2 size={14} className="animate-spin" />
                        </div>
                        <div className="bg-card border border-nexus-border-subtle rounded-lg p-3 text-xs text-muted-foreground">
                            PM Agent generating FAS...
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="border-t border-nexus-border-subtle p-4">
                <div className="flex gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder="Describe your project or ask PM to refine the FAS..."
                        disabled={isLoading}
                        className="flex-1 bg-muted border border-nexus-border-subtle rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50"
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
