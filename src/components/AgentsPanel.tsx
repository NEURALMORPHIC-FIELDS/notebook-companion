import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AGENTS } from "@/data/nexus-data";
import { Sparkles, Settings2, Check, AlertCircle } from "lucide-react";
import AgentConfigPopover from "@/components/AgentConfigPopover";
import { type AgentApiConfig, loadAgentConfigs, saveAgentConfigs } from "@/data/agent-services";

const statusLabel: Record<string, { text: string; color: string }> = {
  active: { text: 'ACTIVE', color: 'bg-nexus-green-dim text-nexus-green' },
  working: { text: 'WORKING', color: 'bg-nexus-amber-dim text-nexus-amber' },
  blocked: { text: 'BLOCKED', color: 'bg-nexus-red-dim text-nexus-red' },
  idle: { text: 'IDLE', color: 'bg-muted text-muted-foreground' },
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
      <div className="nexus-card rounded-lg p-4 nexus-border-glow border">
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
                className={`nexus-card rounded-lg p-4 hover:bg-nexus-surface-hover transition-colors cursor-pointer ${
                  connected > 0 ? 'nexus-border-glow border' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{agent.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{agent.name}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${st.color}`}>
                        {st.text}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{agent.role}</p>

                    {/* Connection status */}
                    <div className="flex items-center gap-2 mt-3 text-[10px] font-mono">
                      {connected > 0 ? (
                        <span className="flex items-center gap-1 text-nexus-green">
                          <Check size={9} /> {connected} API{connected > 1 ? 's' : ''} connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Settings2 size={9} /> Click to configure
                        </span>
                      )}
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
