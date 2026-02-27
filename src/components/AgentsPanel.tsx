import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AGENTS } from "@/data/nexus-data";
import { Sparkles, Settings2, Check, Terminal } from "lucide-react";
import AgentConfigPopover from "@/components/AgentConfigPopover";
import AgentIcon from "@/components/AgentIcon";
import { type AgentApiConfig, loadAgentConfigs, saveAgentConfigs } from "@/data/agent-services";
import { useOrchestratorStore } from "@/hooks/useOrchestratorStore";

// Maps agent.id (from AGENTS[]) → localStorage key (from agent-services.ts)
// Must stay in sync with ROLE_TO_CONFIG_KEY in AgentLLMService.ts
const AGENT_ID_TO_CONFIG_KEY: Record<string, string> = {
  'pm': 'pm',
  'architect': 'architect',
  'devils-advocate': 'da',
  'tech-lead': 'techlead',
  'backend': 'backend',
  'frontend': 'frontend',
  'qa': 'qa',
  'security': 'security',
  'code-reviewer': 'codereviewer',
  'tech-writer': 'techwriter',
  'devops': 'devops',
  'brand': 'brand',
  'uiux': 'uiux',
  'asset-gen': 'assetgen',
};

const getConfigKey = (agentId: string): string => AGENT_ID_TO_CONFIG_KEY[agentId] ?? agentId;

// Category → animation type
const AGENT_ANIM: Record<string, 'scan' | 'pulse' | 'radar' | 'palette' | 'warn'> = {
  pm: 'scan', architect: 'scan', 'tech-lead': 'scan', 'code-reviewer': 'scan',
  backend: 'pulse', frontend: 'pulse', devops: 'pulse',
  qa: 'radar', security: 'radar',
  brand: 'palette', uiux: 'palette', 'asset-gen': 'palette',
  'devils-advocate': 'warn',
};

function AgentWorkingAnimation({ agentId, color }: { agentId: string; color: string }) {
  const type = AGENT_ANIM[agentId] ?? 'scan';
  const c = color.replace('nexus-', '');
  const hex: Record<string, string> = {
    cyan: '#22d3ee', purple: '#a855f7', red: '#ef4444',
    blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b',
  };
  const clr = hex[c] ?? '#22d3ee';

  if (type === 'scan') return (
    <div className="relative flex items-center justify-center w-14 h-14">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="absolute rounded-full border"
          style={{ width: 24 + i * 16, height: 24 + i * 16, borderColor: clr, opacity: 0.6 - i * 0.18 }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.6 - i * 0.18, 0.2, 0.6 - i * 0.18] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }} />
      ))}
      <motion.div className="w-2 h-2 rounded-full" style={{ background: clr }}
        animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
    </div>
  );

  if (type === 'pulse') return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div key={i} className="w-1 rounded-full" style={{ background: clr, originY: 1 }}
          animate={{ height: [8, 24, 8] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }} />
      ))}
    </div>
  );

  if (type === 'radar') return (
    <div className="relative flex items-center justify-center w-14 h-14">
      <div className="absolute rounded-full border opacity-20" style={{ width: 52, height: 52, borderColor: clr }} />
      <div className="absolute rounded-full border opacity-30" style={{ width: 34, height: 34, borderColor: clr }} />
      <motion.div className="absolute w-[26px] h-[2px] origin-left rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${clr})` }}
        animate={{ rotate: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: clr }} />
    </div>
  );

  if (type === 'palette') return (
    <div className="relative flex items-center justify-center w-14 h-14">
      <motion.div className="absolute w-10 h-10 rounded-full"
        style={{ background: `conic-gradient(${clr}, #a855f7, #22d3ee, ${clr})`, opacity: 0.35 }}
        animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
      <motion.div className="absolute w-6 h-6 rounded-full bg-nexus-surface" />
      <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: clr }}
        animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1, repeat: Infinity }} />
    </div>
  );

  // warn (devils-advocate)
  return (
    <div className="relative flex items-center justify-center w-14 h-14">
      {[0, 1].map(i => (
        <motion.div key={i} className="absolute rounded-full border-2"
          style={{ borderColor: clr }}
          animate={{ width: [16, 52], height: [16, 52], opacity: [0.8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }} />
      ))}
      <motion.span className="text-lg" animate={{ scale: [1, 1.2, 1], rotate: [-3, 3, -3] }}
        transition={{ duration: 0.6, repeat: Infinity }}>⚡</motion.span>
    </div>
  );
}

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
  // Live agent statuses from the orchestrator store
  const { agents: liveAgents } = useOrchestratorStore();

  useEffect(() => {
    const loaded = loadAgentConfigs();
    const migrated = { ...loaded };
    let changed = false;

    Object.entries(AGENT_ID_TO_CONFIG_KEY).forEach(([agentId, configKey]) => {
      if (agentId === configKey) return;
      if (migrated[agentId] && !migrated[configKey]) {
        migrated[configKey] = migrated[agentId];
        delete migrated[agentId];
        changed = true;
      }
    });

    if (changed) {
      saveAgentConfigs(migrated);
    }
    setConfigs(migrated);
  }, []);

  const handleSave = (agentId: string, agentConfigs: AgentApiConfig[]) => {
    const configKey = getConfigKey(agentId);
    const updated = { ...configs, [configKey]: agentConfigs };
    if (configKey !== agentId && updated[agentId]) {
      delete updated[agentId];
    }
    setConfigs(updated);
    saveAgentConfigs(updated);
  };

  const getConnectedCount = (agentId: string) => {
    const configKey = getConfigKey(agentId);
    return (configs[configKey] || []).filter(c => c.enabled && c.apiKey).length;
  };

  // Get live status for an agent — falls back to static AGENTS[] if store not yet populated
  const getLiveStatus = (agentId: string) => {
    const live = liveAgents.find(a => a.id === agentId);
    return live?.status ?? AGENTS.find(a => a.id === agentId)?.status ?? 'idle';
  };

  const getLivePhase = (agentId: string) => {
    return liveAgents.find(a => a.id === agentId)?.currentPhase ?? null;
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
          const liveStatus = getLiveStatus(agent.id);
          const livePhase = getLivePhase(agent.id);
          const isWorking = liveStatus === 'active' || liveStatus === 'working';
          const st = statusLabel[liveStatus] ?? statusLabel['idle'];
          const connected = getConnectedCount(agent.id);
          const logs = agentActivity[agent.id] || ['○ No activity'];

          return (
            <AgentConfigPopover
              key={agent.id}
              agent={agent}
              configs={configs[getConfigKey(agent.id)] || []}
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

                  {/* CENTER — working animation (only when actually working live) */}
                  <div className="flex items-center justify-center w-16 shrink-0">
                    <AnimatePresence>
                      {isWorking && (
                        <motion.div key="anim" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.3 }}>
                          <AgentWorkingAnimation agentId={agent.id} color={agent.color} />
                          {livePhase && (
                            <p className="text-[9px] font-mono text-center mt-1" style={{ color: '#22d3ee' }}>
                              Phase {livePhase}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* RIGHT — mini terminal info */}
                  <div className="w-[310px] shrink-0 bg-black/40 rounded-lg px-3 py-2.5 border border-border/40">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Terminal size={10} className="text-nexus-green" />
                      <span className="text-[9px] font-mono font-bold text-nexus-green/90 uppercase tracking-wider">Activity</span>
                    </div>
                    <div className="space-y-1">
                      {logs.map((line, j) => (
                        <p key={j} className={`text-[10px] font-mono leading-snug ${line.startsWith('▸') ? 'text-muted-foreground' : 'text-muted-foreground/50'
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
