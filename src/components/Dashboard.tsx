import { motion } from "framer-motion";
import { SDLC_PHASES, AGENTS, MOCK_MODULES } from "@/data/nexus-data";
import { CheckCircle, Clock, AlertTriangle, Lock, Zap, Shield, Bot, Activity, ArrowUpRight } from "lucide-react";
import AgentIcon from "@/components/AgentIcon";

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle size={14} className="text-nexus-green" />;
    case 'in-progress': return <Clock size={14} className="text-nexus-amber" />;
    case 'blocked': return <Lock size={14} className="text-nexus-red" />;
    default: return <div className="w-3.5 h-3.5 rounded-full border border-nexus-text-dim" />;
  }
};

const agentStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-nexus-green';
    case 'working': return 'bg-nexus-amber';
    case 'blocked': return 'bg-nexus-red';
    default: return 'bg-nexus-text-dim';
  }
};

export default function Dashboard() {
  const completedPhases = SDLC_PHASES.filter(p => p.status === 'completed').length;
  const totalPhases = SDLC_PHASES.length;
  const wired = MOCK_MODULES.filter(m => m.category === 'WIRED').length;
  const notWired = MOCK_MODULES.filter(m => m.category === 'NOT_WIRED').length;
  const criticalMissing = MOCK_MODULES.filter(m => m.category === 'NOT_WIRED' && m.isCritical).length;
  const activeAgents = AGENTS.filter(a => a.status === 'active' || a.status === 'working').length;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold nexus-gradient-text">Project Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">ultra-trader-v2 • Phase 3A — Architecture</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Activity size={18} />}
          label="SDLC Progress"
          value={`${completedPhases}/${totalPhases}`}
          sub={`${Math.round((completedPhases/totalPhases)*100)}% complete`}
          color="primary"
        />
        <StatCard
          icon={<Shield size={18} />}
          label="Veritas Status"
          value={criticalMissing > 0 ? `EXIT 1` : 'EXIT 0'}
          sub={criticalMissing > 0 ? `${criticalMissing} critical NOT_WIRED` : 'All critical WIRED'}
          color={criticalMissing > 0 ? 'destructive' : 'green'}
        />
        <StatCard
          icon={<Zap size={18} />}
          label="Modules"
          value={`${wired}/${wired + notWired}`}
          sub={`${notWired} NOT_WIRED`}
          color="amber"
        />
        <StatCard
          icon={<Bot size={18} />}
          label="Active Agents"
          value={`${activeAgents}`}
          sub={`${AGENTS.length} total configured`}
          color="primary"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* SDLC Phases */}
        <div className="col-span-2 nexus-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Activity size={13} />
            </div>
            SDLC Phases
          </h2>
          <div className="space-y-1">
            {SDLC_PHASES.map((phase, i) => (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                  phase.status === 'in-progress' ? 'bg-nexus-surface-hover nexus-border-glow border' : 'hover:bg-nexus-surface-hover border border-transparent'
                }`}
              >
                <span className="font-mono text-muted-foreground w-6 text-right">{phase.number}</span>
                {statusIcon(phase.status)}
                <span className={`flex-1 ${phase.status === 'in-progress' ? 'text-foreground font-medium' : 'text-secondary-foreground'}`}>
                  {phase.name}
                </span>
                <span className="text-nexus-text-dim font-mono text-[10px] truncate max-w-32">{phase.agent}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Agents Panel */}
        <div className="nexus-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Bot size={13} />
            </div>
            Agent Status
          </h2>
          <div className="space-y-1.5">
            {AGENTS.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs hover:bg-nexus-surface-hover transition-colors"
              >
                <AgentIcon icon={agent.icon} color={agent.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-secondary-foreground truncate">{agent.name}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${agentStatusColor(agent.status)}`} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Veritas Quick View */}
      <div className="nexus-card rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Shield size={13} />
          </div>
          Veritas Ground Truth — Module State Matrix
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {['WIRED', 'NOT_WIRED', 'TEST', 'CONFIG'].map(cat => {
            const modules = MOCK_MODULES.filter(m => m.category === cat);
            const color = cat === 'WIRED' ? 'nexus-green' : cat === 'NOT_WIRED' ? 'nexus-red' : cat === 'TEST' ? 'nexus-blue' : 'nexus-text-dim';
            return (
              <div key={cat} className="rounded-xl bg-nexus-surface-hover/60 p-3.5 border border-transparent hover:border-nexus-border-subtle transition-colors">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className={`w-2 h-2 rounded-full bg-${color}`} />
                  <span className="text-xs font-mono font-semibold text-secondary-foreground">{cat}</span>
                  <span className="text-xs text-muted-foreground ml-auto font-mono">{modules.length}</span>
                </div>
                <div className="space-y-0.5">
                  {modules.map(m => (
                    <div key={m.name} className="flex items-center gap-1.5 text-[10px] font-mono text-nexus-text-secondary">
                      {m.isCritical && <AlertTriangle size={9} className="text-nexus-amber flex-shrink-0" />}
                      <span className="truncate">{m.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary',
    destructive: 'text-destructive',
    green: 'text-nexus-green',
    amber: 'text-nexus-amber',
  };
  const bgMap: Record<string, string> = {
    primary: 'bg-primary/10',
    destructive: 'bg-destructive/10',
    green: 'bg-nexus-green/10',
    amber: 'bg-nexus-amber/10',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="nexus-card rounded-xl p-4 group hover:nexus-border-glow transition-all duration-300"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg ${bgMap[color] || 'bg-primary/10'} ${colorMap[color] || 'text-primary'} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold font-mono ${colorMap[color] || 'text-foreground'}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>
    </motion.div>
  );
}
