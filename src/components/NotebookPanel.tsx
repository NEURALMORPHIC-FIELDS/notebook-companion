import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Play, Plus, Trash2, CheckCircle, XCircle, Terminal,
  FileCode, Bot, Loader2, Cpu, Wand2
} from "lucide-react";
import { toast } from "sonner";
import { loadAgentConfigs, type AgentApiConfig } from "@/data/agent-services";

interface NotebookCell {
  id: number;
  code: string;
  output: string | null;
  status: 'idle' | 'running' | 'success' | 'error';
  agent: string; // Which agent processed this
}

const STORAGE_KEY = 'nexus-notebook-cells';

const AGENT_ROLES: { id: string; label: string; systemPrompt: string }[] = [
  {
    id: 'code-review',
    label: 'Code Reviewer',
    systemPrompt: 'You are the Code Reviewer agent. Analyze the code for bugs, silent drops, code smells, and best practices. Return a structured review with severity levels (CRITICAL, WARNING, INFO). Be concise.',
  },
  {
    id: 'qa-test',
    label: 'QA Engineer',
    systemPrompt: 'You are the QA Engineer agent. Generate unit tests for the provided code. Output valid test code with assertions. Map each test to a functional requirement. Be concise.',
  },
  {
    id: 'security',
    label: 'Security Auditor',
    systemPrompt: 'You are the Security Auditor agent. Perform an OWASP-aligned security audit on this code. Identify vulnerabilities, injection risks, and dependency issues. Output structured findings. Be concise.',
  },
  {
    id: 'architect',
    label: 'Architect',
    systemPrompt: 'You are the Architect agent. Analyze this code architecturally. Check for SOLID violations, coupling, scalability issues. Suggest refactoring patterns. Be concise.',
  },
  {
    id: 'tech-writer',
    label: 'Tech Writer',
    systemPrompt: 'You are the Tech Writer agent. Generate documentation for this code: JSDoc/docstrings, README section, and usage examples. Be concise.',
  },
  {
    id: 'explain',
    label: 'Explain Code',
    systemPrompt: 'You are a senior developer. Explain what this code does step by step in plain English. Highlight any issues or edge cases. Be concise.',
  },
];

function getActivePmConfig(): AgentApiConfig | null {
  const allConfigs = loadAgentConfigs();
  const pmConfigs = allConfigs['pm'] || [];
  const custom = pmConfigs.find(c => c.serviceId === 'custom' && c.enabled);
  if (custom) return custom;
  const withKey = pmConfigs.find(c => c.enabled && c.apiKey);
  if (withKey) return withKey;
  return null;
}

function loadSavedCells(): NotebookCell[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [{ id: 1, code: '', output: null, status: 'idle', agent: '' }];
}

function persistCells(cells: NotebookCell[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cells));
  } catch { /* ignore */ }
}

export default function NotebookPanel() {
  const [cells, setCells] = useState<NotebookCell[]>(loadSavedCells);
  const [selectedAgent, setSelectedAgent] = useState(AGENT_ROLES[0].id);

  useEffect(() => {
    persistCells(cells);
  }, [cells]);

  const runCell = async (id: number) => {
    const cell = cells.find(c => c.id === id);
    if (!cell || !cell.code.trim()) {
      toast.error('Cell is empty. Write or paste code first.');
      return;
    }

    const config = getActivePmConfig();
    if (!config || !config.baseUrl) {
      toast.error('No Custom LLM configured. Go to Agents → Project Manager → Enable Custom LLM API.');
      return;
    }

    const agentRole = AGENT_ROLES.find(r => r.id === selectedAgent) || AGENT_ROLES[0];

    setCells(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'running', output: null, agent: agentRole.label } : c
    ));

    try {
      const chatEndpoint = config.chatApi || `${config.baseUrl}/chat/completions`;
      const resp = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model || 'default',
          messages: [
            { role: 'system', content: agentRole.systemPrompt },
            { role: 'user', content: `Analyze this code:\n\n\`\`\`\n${cell.code}\n\`\`\`` },
          ],
          stream: false,
          max_tokens: 2048,
          temperature: 0.3,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      let content = data.choices?.[0]?.message?.content || 'No response from agent.';
      // Strip <think> tags if present (DeepSeek R1)
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      setCells(prev => prev.map(c =>
        c.id === id ? { ...c, status: 'success', output: content } : c
      ));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      setCells(prev => prev.map(c =>
        c.id === id ? { ...c, status: 'error', output: `ERROR: ${errMsg}` } : c
      ));
      toast.error(errMsg);
    }
  };

  const addCell = () => {
    setCells(prev => [...prev, {
      id: Date.now(),
      code: '',
      output: null,
      status: 'idle',
      agent: '',
    }]);
  };

  const deleteCell = (id: number) => {
    setCells(prev => prev.filter(c => c.id !== id));
  };

  const updateCode = (id: number, code: string) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, code } : c));
  };

  const clearAll = () => {
    setCells([{ id: Date.now(), code: '', output: null, status: 'idle', agent: '' }]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const config = getActivePmConfig();
  const llmLabel = config?.model ? `${config.model}` : 'Not configured';

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold nexus-gradient-text">Notebook</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Write or paste code — agents analyze, review, test, and document it via your LLM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearAll}
            className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={addCell}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-xs hover:bg-nexus-surface-hover transition-colors"
          >
            <Plus size={14} /> Add Cell
          </button>
        </div>
      </div>

      {/* Agent Selector + LLM Status */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <Cpu size={12} className="text-primary" />
          <span>LLM: <span className="text-primary font-bold">{llmLabel}</span></span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <Bot size={12} className="text-nexus-green" />
          <span className="text-[10px] font-mono text-muted-foreground">Agent:</span>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-muted border border-border rounded px-2 py-0.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer"
          >
            {AGENT_ROLES.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cells */}
      {cells.map((cell, i) => (
        <motion.div
          key={cell.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className={`nexus-card rounded-lg overflow-hidden ${cell.status === 'error' ? 'border-nexus-red/30' : cell.status === 'success' ? 'border-nexus-green/30' : ''
            }`}
        >
          {/* Cell Header */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-nexus-surface-hover border-b border-nexus-border-subtle">
            <FileCode size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground">Cell [{i + 1}]</span>
            {cell.agent && (
              <span className="text-[9px] font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">
                {cell.agent}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => runCell(cell.id)}
                disabled={cell.status === 'running'}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-nexus-green-dim text-nexus-green hover:bg-nexus-green/20 transition-colors disabled:opacity-50"
              >
                {cell.status === 'running' ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                {cell.status === 'running' ? 'Analyzing...' : 'Run'}
              </button>
              <button
                onClick={() => deleteCell(cell.id)}
                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Code Editor */}
          <textarea
            value={cell.code}
            onChange={(e) => updateCode(cell.id, e.target.value)}
            spellCheck={false}
            className="w-full bg-nexus-deep text-foreground font-mono text-xs p-4 resize-none focus:outline-none min-h-[80px] placeholder:text-nexus-text-dim"
            placeholder="// Paste or write code here... then click Run to send to the selected agent"
            rows={Math.max(cell.code.split('\n').length + 1, 4)}
          />

          {/* Output */}
          {cell.output && (
            <div className={`border-t px-4 py-3 font-mono text-xs whitespace-pre-wrap ${cell.status === 'error'
                ? 'bg-nexus-red-dim/10 border-nexus-red/20 text-nexus-red'
                : 'bg-nexus-green-dim/10 border-nexus-green/20 text-foreground'
              }`}>
              <div className="flex items-center gap-1.5 mb-2 text-[10px]">
                {cell.status === 'error'
                  ? <><XCircle size={10} className="text-nexus-red" /><span className="text-nexus-red">Error</span></>
                  : <><CheckCircle size={10} className="text-nexus-green" /><span className="text-nexus-green">{cell.agent} — Analysis Complete</span></>
                }
              </div>
              {cell.output}
            </div>
          )}

          {cell.status === 'running' && (
            <div className="border-t border-nexus-border-subtle px-4 py-3 flex items-center gap-2">
              <Wand2 size={12} className="text-nexus-amber animate-pulse" />
              <span className="text-[10px] font-mono text-nexus-amber">
                {AGENT_ROLES.find(r => r.id === selectedAgent)?.label || 'Agent'} analyzing code...
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
