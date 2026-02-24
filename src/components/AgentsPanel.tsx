import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AGENTS } from "@/data/nexus-data";
import { Sparkles, Settings2, Check, Terminal } from "lucide-react";
import AgentConfigPopover from "@/components/AgentConfigPopover";
import AgentIcon from "@/components/AgentIcon";
import { type AgentApiConfig, loadAgentConfigs, saveAgentConfigs } from "@/data/agent-services";

const statusLabel: Record<string, { text: string; color: string }> = {
  active: { text: 'ACTIVE', color: 'bg-nexus-green/15 text-nexus-green ring-1 ring-nexus-green/20' },
  working: { text: 'WORKING', color: 'bg-nexus-amber/15 text-nexus-amber ring-1 ring-nexus-amber/20' },
  blocked: { text: 'BLOCKED', color: 'bg-nexus-red/15 text-nexus-red ring-1 ring-nexus-red/20' },
  idle: { text: 'IDLE', color: 'bg-muted text-muted-foreground ring-1 ring-border' },
};

// Activity log per agent — shows current workflow state
const agentActivity: Record<string, string[]> = {
  pm: ['▸ Phase 1A: FAS generated', '▸ PRD: 12 user stories', '▸ Awaiting Phase 2 input'],
  architect: ['▸ Phase 3A: ADR pending', '▸ Waiting for PM output', '○ Idle — no active task'],
  'devils-advocate': ['▸ Contestation engine ready', '▸ 8 check functions loaded', '▸ Monitoring agent outputs'],
  'tech-lead': ['▸ Phase 4: Standby', '▸ Threshold calibration ready', '○ Waiting for architecture'],
  backend: ['▸ Phase 6A: Standby', '▸ Ran≠Worked reporter active', '○ Waiting for tech spec'],
  frontend: ['▸ Phase 6A: Standby', '▸ Design system pending', '○ Waiting for wireframes'],
  qa: ['▸ Phase 8: Standby', '▸ FAS test mapping ready', '○ No test suites yet'],
  security: ['▸ Phase 9: Standby', '▸ OWASP checklist loaded', '○ Waiting for codebase'],
  'code-reviewer': ['▸ Phase 7: Standby', '▸ SilentDropMonitor active', '○ No PRs to review'],
  'tech-writer': ['▸ Phase 10: Standby', '▸ Templates loaded', '○ Waiting for stable code'],
  devops: ['▸ Phase 11: Standby', '▸ CI/CD templates ready', '○ Waiting for QA pass'],
  brand: ['▸ Phase 3B: Standby', '▸ Color palette defined', '○ Waiting for PRD'],
  uiux: ['▸ Phase 3B: Standby', '▸ Design tokens ready', '○ Waiting for brand guide'],
  'asset-gen': ['▸ Phase 6B: Standby', '▸ Multi-provider pipeline', '○ Waiting for design'],
};

export default function AgentsPanel() {
  const [configs, setConfigs] = useState<Record<string, AgentApiConfig[]>>({});

  useEffect(() => {
    setConfigs(loadAgentConfigs());
  }, []);

  const handleSave = (agentId: string, agentConfigs: AgentApiConfig[]) => {
    const updated = { ...configs, [agentId]: agentConfigs };
    setConfigs(updated);
    saveAgentConfigs(updated);
  };

  const getConnectedCount = (agentId: string) => {
    return (configs[agentId] || []).filter(c => c.enabled && c.apiKey).length;
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold nexus-gradient-text">Agent Orchestra</h1>
        <p className="text-sm text-muted-foreground mt-1">14 specialized agents — configure API services per role.</p>
      </div>

      {/* Behavioral Rules Banner */}
      <div className="nexus-card rounded-xl p-4 nexus-border-glow border">
        <h3 className="text-xs font-semibold text-primary mb-2 flex items-center gap-2">
          <Sparkles size={12} />
          v6 Behavioral Rules Active
        </h3>
        <div className="grid grid-cols-5 gap-2 text-[10px] font-mono text-muted-foreground">
          <span>#1 Zero Spam</span>
          <span>#2 Ran ≠ Worked</span>
          <span>#3 Zero Silent Fail</span>
          <span>#4 Namespaced Cache</span>
          <span>#5 OPEN → CLOSE</span>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-2 gap-4">
        {AGENTS.map((agent, i) => {
          const st = statusLabel[agent.status];
          const connected = getConnectedCount(agent.id);
          const logs = agentActivity[agent.id] || ['○ No activity'];

          return (
            <AgentConfigPopover
              key={agent.id}
              agent={agent}
              configs={configs[agent.id] || []}
              onSave={handleSave}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`nexus-card rounded-xl p-4 hover:bg-nexus-surface-hover transition-all duration-200 cursor-pointer group ${connected > 0 ? 'nexus-border-glow border' : ''
                  }`}
              >
                <div className="flex items-start gap-3">
                  {/* LEFT — icon + name + status */}
                  <AgentIcon icon={agent.icon} color={agent.color} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{agent.name}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${st.color}`}>
                        {st.text}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{agent.role}</p>

                    {/* Connection status */}
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                      {connected > 0 ? (
                        <span className="flex items-center gap-1 text-nexus-green">
                          <Check size={9} /> {connected} API{connected > 1 ? 's' : ''} connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
                          <Settings2 size={9} /> Click to configure
                        </span>
                      )}
                    </div>
                  </div>

                  {/* RIGHT — mini terminal info */}
                  <div className="w-[180px] shrink-0 bg-black/30 rounded-md px-2 py-1.5 border border-border/30">
                    <div className="flex items-center gap-1 mb-1">
                      <Terminal size={8} className="text-nexus-green" />
                      <span className="text-[8px] font-mono font-bold text-nexus-green/80 uppercase">Activity</span>
                    </div>
                    <div className="space-y-0.5">
                      {logs.map((line, j) => (
                        <p key={j} className={`text-[9px] font-mono leading-tight truncate ${line.startsWith('▸') ? 'text-muted-foreground' : 'text-muted-foreground/50'
                          }`}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AgentConfigPopover>
          );
        })}
      </div>
    </div>
  );
}
