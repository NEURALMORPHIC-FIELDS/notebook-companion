import { motion } from "framer-motion";
import { AGENTS } from "@/data/nexus-data";
import { Bot, Cpu, MessageSquare, Sparkles } from "lucide-react";

const statusLabel: Record<string, { text: string; color: string }> = {
  active: { text: 'ACTIVE', color: 'bg-nexus-green-dim text-nexus-green' },
  working: { text: 'WORKING', color: 'bg-nexus-amber-dim text-nexus-amber' },
  blocked: { text: 'BLOCKED', color: 'bg-nexus-red-dim text-nexus-red' },
  idle: { text: 'IDLE', color: 'bg-muted text-muted-foreground' },
};

export default function AgentsPanel() {
  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold nexus-gradient-text">Agent Orchestra</h1>
        <p className="text-sm text-muted-foreground mt-1">14 specialized agents replicating a full development team.</p>
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
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`nexus-card rounded-lg p-4 hover:bg-nexus-surface-hover transition-colors cursor-pointer ${
                agent.status === 'working' ? 'nexus-border-glow border' : ''
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

                  {/* Mock stats */}
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-nexus-text-dim font-mono">
                    <span className="flex items-center gap-1">
                      <Cpu size={9} /> {Math.floor(Math.random() * 5000 + 200)} tokens
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={9} /> {Math.floor(Math.random() * 20)} msgs
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
