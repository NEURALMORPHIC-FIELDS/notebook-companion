/**
 * HITLPanel.tsx — Human-In-The-Loop Approval Panel
 * NEXUS AI v6
 *
 * Rich preview + chat + Approve / Modify flow.
 * Renders agent output as: markdown, code (syntax), colors, CSS animations.
 * Chat window lets user request changes before approving.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOrchestratorStore } from "@/hooks/useOrchestratorStore";
import {
  orchestratorStore,
  AUTONOMY_MODE_OPTIONS,
  type AutonomyMode,
} from "@/stores/OrchestratorStore";
import { ApprovalRequest } from "@/hitl/ApprovalRequest";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Bot,
  MessageSquare, ChevronDown, ChevronUp, Eye, Code,
  Sparkles, Send, Pencil, History, Palette
} from "lucide-react";
import { toast } from "sonner";
import { callAgentLLM } from "@/services/AgentLLMService";

// ── Minimal markdown → HTML renderer ────────────────────────────────────────
function renderMarkdown(text: string): string {
  return text
    .replace(/^#{3}\s+(.+)$/gm, '<h3 class="text-base font-bold text-primary mt-4 mb-1">$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2 class="text-lg font-bold text-foreground mt-5 mb-2">$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1 class="text-xl font-bold nexus-gradient-text mt-5 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-muted-foreground italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-nexus-deep text-primary font-mono text-xs">$1</code>')
    .replace(/^[-*]\s+(.+)$/gm, '<li class="ml-4 text-sm text-foreground list-disc">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/gs, '<ul class="space-y-1 my-2">$&</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

// ── Extract code blocks from agent output ────────────────────────────────────
interface CodeBlock { lang: string; code: string }
function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    blocks.push({ lang: m[1] || 'text', code: m[2].trim() });
  }
  return blocks;
}

// ── Extract CSS color values from text ───────────────────────────────────────
function extractColors(text: string): string[] {
  const colorRe = /#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)|hsl\([^)]+\)/g;
  return [...new Set(text.match(colorRe) ?? [])].slice(0, 12);
}

// ── Preview component ────────────────────────────────────────────────────────
function AgentOutputPreview({ content, phase }: { content: string; phase: string }) {
  const [tab, setTab] = useState<'preview' | 'raw' | 'code' | 'design'>('preview');
  const codeBlocks = extractCodeBlocks(content);
  const colors = extractColors(content);
  const hasDesign = colors.length > 0 || phase === '3B' || content.toLowerCase().includes('color') || content.toLowerCase().includes('font');

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-3 border-b border-nexus-border-subtle">
        {[
          { key: 'preview', label: 'Preview', icon: Eye },
          { key: 'code', label: `Code (${codeBlocks.length})`, icon: Code, hide: codeBlocks.length === 0 },
          { key: 'design', label: 'Design', icon: Palette, hide: !hasDesign },
          { key: 'raw', label: 'Raw', icon: Sparkles },
        ].filter(t => !t.hide).map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${tab === t.key
                ? 'text-primary border-primary bg-primary/5'
                : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}>
            <t.icon size={11} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'preview' && (
          <div
            className="prose prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}

        {tab === 'raw' && (
          <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {content}
          </pre>
        )}

        {tab === 'code' && (
          <div className="space-y-4">
            {codeBlocks.length === 0
              ? <p className="text-xs text-muted-foreground">No code blocks found.</p>
              : codeBlocks.map((block, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-nexus-border-subtle">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-nexus-deep text-[10px] font-mono text-muted-foreground border-b border-nexus-border-subtle">
                    <Code size={10} /> {block.lang || 'text'} · {block.code.split('\n').length} lines
                  </div>
                  <pre className="p-4 text-[11px] font-mono text-foreground whitespace-pre-wrap overflow-x-auto leading-relaxed bg-black/30">
                    {block.code}
                  </pre>
                </div>
              ))
            }
          </div>
        )}

        {tab === 'design' && (
          <div className="space-y-4">
            {colors.length > 0 && (
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-2">Colors detected in output</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-nexus-deep border border-nexus-border-subtle text-[10px] font-mono">
                      <div className="w-5 h-5 rounded-md border border-white/10 shrink-0" style={{ background: color }} />
                      <span className="text-foreground">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Typography preview from output */}
            {content.toLowerCase().includes('font') && (
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-2">Typography mentions</p>
                <div className="space-y-1">
                  {content.match(/font[- ](?:family|face|size)[:\s]+([^\n,;]+)/gi)?.slice(0, 5).map((f, i) => (
                    <div key={i} className="px-3 py-1.5 rounded bg-nexus-deep text-xs font-mono text-foreground">{f.trim()}</div>
                  ))}
                </div>
              </div>
            )}

            {colors.length === 0 && !content.toLowerCase().includes('font') && (
              <p className="text-xs text-muted-foreground">No design tokens detected. View Preview tab.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat message ─────────────────────────────────────────────────────────────
interface ChatMsg { role: 'user' | 'agent'; text: string; time: string }

// ═══════════════════════════════════════════════════════════════════════════════

export default function HITLPanel() {
  const { pendingApprovals, approvalHistory, autonomyMode, approvedAgentRoles } = useOrchestratorStore();
  const [activeRequest, setActiveRequest] = useState<ApprovalRequest | null>(null);
  const [chatMsgs, setChatMsgs] = useState<Record<string, ChatMsg[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleAutonomyModeChange = (mode: AutonomyMode) => {
    orchestratorStore.setAutonomyMode(mode);
    toast.success(`Autonomy mode set to ${mode}`);
  };

  // Auto-open first pending on load
  useEffect(() => {
    if (pendingApprovals.length > 0 && !activeRequest) {
      setActiveRequest(pendingApprovals[0]);
    }
  }, [pendingApprovals, activeRequest]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs, activeRequest]);

  const msgs = activeRequest ? (chatMsgs[activeRequest.id] ?? []) : [];

  const addMsg = (reqId: string, msg: ChatMsg) => {
    setChatMsgs(prev => ({ ...prev, [reqId]: [...(prev[reqId] ?? []), msg] }));
  };

  // ── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = (req: ApprovalRequest) => {
    orchestratorStore.resolveApproval(req.id, 'APPROVED');
    setActiveRequest(null);
    toast.success(`Phase ${req.phase} approved — pipeline continues.`);
  };

  // ── Modify: send user message to agent, wait for revised output ────────────
  const handleModify = async (req: ApprovalRequest) => {
    if (!chatInput.trim()) {
      toast.error('Scrie ce dorești să modifici în câmpul de chat.');
      return;
    }
    const userText = chatInput.trim();
    setChatInput('');
    setSending(true);

    addMsg(req.id, { role: 'user', text: userText, time: new Date().toLocaleTimeString() });

    try {
      const revised = await callAgentLLM({
        agentRole: req.agentRole,
        messages: [
          { role: 'user', content: `Previous output:\n\n${req.summary}\n\nUser requested changes:\n${userText}\n\nPlease generate a revised version incorporating these changes.` }
        ],
        phase: req.phase,
      });

      addMsg(req.id, { role: 'agent', text: revised, time: new Date().toLocaleTimeString() });

      // Update the approval request summary with revised output (in-memory update for preview)
      // The revised version will be used when user clicks Approve
      const updated = orchestratorStore.updateApprovalSummary(req.id, revised);
      if (!updated) {
        toast.error('Nu am putut actualiza cererea HITL cu varianta revizuită.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      addMsg(req.id, { role: 'agent', text: `Error generating revision: ${msg}`, time: new Date().toLocaleTimeString() });
      toast.error('Failed to get revision from agent.');
    } finally {
      setSending(false);
    }
  };

  // ── Reject ─────────────────────────────────────────────────────────────────
  const handleReject = (req: ApprovalRequest) => {
    orchestratorStore.resolveApproval(req.id, 'REJECTED', 'Rejected by user.');
    setActiveRequest(null);
    toast.error(`Phase ${req.phase} rejected — blocked.`);
  };

  const statusBadge = (status: string) => {
    if (status === 'PENDING') return <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-nexus-amber/15 text-nexus-amber flex items-center gap-1"><Clock size={8} /> PENDING</span>;
    if (status === 'APPROVED') return <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-nexus-green/15 text-nexus-green flex items-center gap-1"><CheckCircle size={8} /> APPROVED</span>;
    return <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-nexus-red/15 text-nexus-red flex items-center gap-1"><XCircle size={8} /> REJECTED</span>;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Panel layout: sidebar list + main detail ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: pending list */}
          <div className="w-64 flex-shrink-0 border-r border-nexus-border-subtle flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-nexus-border-subtle">
              <h2 className="text-sm font-bold nexus-gradient-text">HITL Approvals</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">{pendingApprovals.length} pending</p>
            </div>

            <div className="px-3 py-3 border-b border-nexus-border-subtle space-y-2 bg-black/10">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                Autonomy policy
              </p>
              <div className="space-y-1">
                {AUTONOMY_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.mode}
                    onClick={() => handleAutonomyModeChange(option.mode)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors ${
                      autonomyMode === option.mode
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-nexus-border-subtle hover:border-primary/30 hover:bg-nexus-surface-hover'
                    }`}
                  >
                    <p className={`text-[10px] font-semibold ${autonomyMode === option.mode ? 'text-primary' : 'text-foreground'}`}>
                      {option.title}
                    </p>
                    <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
              {autonomyMode === 2 && (
                <p className="text-[9px] text-muted-foreground">
                  Agents approved: <span className="text-primary font-mono">{approvedAgentRoles.length}</span>
                </p>
              )}
              {autonomyMode === 5 && (
                <p className="text-[9px] text-nexus-amber">
                  Mode 5 active: HITL skipped and GitHub auto-commit is blocked.
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
            {pendingApprovals.length === 0 && (
              <div className="p-6 text-center">
                <CheckCircle size={28} className="mx-auto text-nexus-green mb-2" />
                <p className="text-xs text-muted-foreground">No pending approvals</p>
              </div>
            )}
            {pendingApprovals.map((req, i) => (
              <button key={req.id} onClick={() => setActiveRequest(req)}
                className={`w-full text-left px-4 py-3 border-b border-nexus-border-subtle transition-colors ${activeRequest?.id === req.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-nexus-surface-hover'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Bot size={12} className="text-primary shrink-0" />
                  <span className="text-xs font-semibold truncate">Phase {req.phase}</span>
                  {statusBadge(req.status)}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{req.agentRole}</p>
                <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">
                  {new Date(req.createdAt).toLocaleTimeString('ro-RO')}
                </p>
                {(chatMsgs[req.id]?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-primary">
                    <MessageSquare size={8} /> {chatMsgs[req.id].length} messages
                  </div>
                )}
              </button>
            ))}

            {/* History toggle */}
            <button onClick={() => setShowHistory(!showHistory)}
              className="w-full px-4 py-2 text-left text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 border-t border-nexus-border-subtle">
              <History size={10} /> History ({approvalHistory.length})
              {showHistory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showHistory && approvalHistory.map(req => (
              <button key={req.id} onClick={() => setActiveRequest(req)}
                className="w-full text-left px-4 py-2 border-b border-nexus-border-subtle/50 hover:bg-nexus-surface-hover transition-colors opacity-60">
                <div className="flex items-center gap-2">
                  {statusBadge(req.status)}
                  <span className="text-[10px] font-mono">Phase {req.phase}</span>
                  <span className="text-[9px] text-muted-foreground truncate">{req.agentRole}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: detail + preview + chat */}
        {activeRequest ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-nexus-border-subtle bg-nexus-deep shrink-0">
              <Bot size={16} className="text-primary" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">
                  Phase {activeRequest.phase} — {activeRequest.agentRole}
                </h3>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {new Date(activeRequest.createdAt).toLocaleString('ro-RO')}
                </p>
              </div>
              {statusBadge(activeRequest.status)}
              {(activeRequest.blockedByDA || activeRequest.veritasExitCode !== 0) && (
                <span className="flex items-center gap-1 text-[10px] text-nexus-red bg-nexus-red/10 px-2 py-1 rounded">
                  <AlertTriangle size={10} />
                  {activeRequest.blockedByDA ? "DA BLOCKED" : `Veritas EXIT ${activeRequest.veritasExitCode}`}
                </span>
              )}
            </div>

            {/* Preview area */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {/* Agent output preview */}
              <div className="flex-1 overflow-hidden">
                <AgentOutputPreview
                  content={
                    // Use last agent revision if available
                    msgs.filter(m => m.role === 'agent').at(-1)?.text ?? activeRequest.summary
                  }
                  phase={activeRequest.phase}
                />
              </div>

              {/* Chat thread */}
              {msgs.length > 0 && (
                <div className="border-t border-nexus-border-subtle max-h-48 overflow-y-auto p-3 space-y-2 bg-black/20">
                  {msgs.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-nexus-deep border border-primary/30 text-primary'}`}>
                        {msg.role === 'user' ? 'U' : 'A'}
                      </div>
                      <div className={`max-w-[75%] px-3 py-2 rounded-xl text-[11px] leading-relaxed ${msg.role === 'user' ? 'bg-primary/15 text-foreground rounded-tr-none' : 'bg-nexus-deep text-foreground rounded-tl-none border border-nexus-border-subtle'}`}>
                        {msg.text.length > 300 ? msg.text.slice(0, 300) + '…' : msg.text}
                        <span className="block text-[8px] text-muted-foreground/60 mt-1">{msg.time}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Actions bar */}
            {activeRequest.status === 'PENDING' && (
              <div className="shrink-0 border-t border-nexus-border-subtle p-3 space-y-2 bg-nexus-deep">
                {/* Chat input */}
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleModify(activeRequest)}
                    placeholder="Cere modificări agentului… (Ex: schimbă culoarea în albastru, adaugă autentificare)"
                    disabled={sending}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-black/40 border border-nexus-border-subtle text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <button onClick={() => handleModify(activeRequest)} disabled={sending || !chatInput.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-nexus-amber/15 text-nexus-amber border border-nexus-amber/25 hover:bg-nexus-amber/25 transition-colors disabled:opacity-50">
                    {sending ? <><span className="animate-spin">⟳</span> Revising…</> : <><Pencil size={11} /> Modify</>}
                  </button>
                </div>

                {/* Approve / Reject */}
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(activeRequest)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-nexus-green/20 text-nexus-green border border-nexus-green/30 hover:bg-nexus-green/30 transition-colors">
                    <CheckCircle size={15} /> Approve — Continue Pipeline
                  </button>
                  <button onClick={() => handleReject(activeRequest)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-nexus-red/10 text-nexus-red border border-nexus-red/20 hover:bg-nexus-red/20 transition-colors">
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <CheckCircle size={48} className="mx-auto text-nexus-green/40 mb-3" />
              <p className="text-sm text-muted-foreground">No approval selected</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {pendingApprovals.length > 0
                  ? 'Select a pending approval from the left'
                  : 'All phases approved — pipeline complete'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
