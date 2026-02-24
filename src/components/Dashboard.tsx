import { motion } from "framer-motion";
import { useOrchestratorStore } from "@/hooks/useOrchestratorStore";
import { CheckCircle, Clock, AlertTriangle, Lock, Zap, Shield, Bot, Activity } from "lucide-react";
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
  const { phases, agents, pendingApprovals, veritasExitCode } = useOrchestratorStore();

  const completedPhases = phases.filter(p => p.status === 'completed').length;
  const totalPhases = phases.length;
  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'working').length;
  const currentPhase = phases.find(p => p.status === 'in-progress');

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold nexus-gradient-text">Project Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          {currentPhase ? `Phase ${currentPhase.number} — ${currentPhase.name}` : 'No active phase'}
          {pendingApprovals.length > 0 && (
            <span className="ml-2 text-nexus-amber">• {pendingApprovals.length} pending approvals</span>
          )}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Activity size={18} />}
          label="SDLC Progress"
          value={`${completedPhases}/${totalPhases}`}
          sub={`${Math.round((completedPhases / totalPhases) * 100)}% complete`}
          color="primary"
        />
        <StatCard
          icon={<Shield size={18} />}
          label="Veritas Status"
          value={veritasExitCode === 0 ? 'EXIT 0' : veritasExitCode === -1 ? 'N/A' : `EXIT ${veritasExitCode}`}
          sub={veritasExitCode === 0 ? 'All critical WIRED' : veritasExitCode === -1 ? 'Not yet run' : 'Critical NOT_WIRED'}
          color={veritasExitCode === 0 ? 'green' : veritasExitCode === -1 ? 'amber' : 'destructive'}
        />
        <StatCard
          icon={<Zap size={18} />}
          label="Pending Approvals"
          value={`${pendingApprovals.length}`}
          sub={pendingApprovals.length > 0 ? 'Awaiting HITL review' : 'No pending'}
          color={pendingApprovals.length > 0 ? 'amber' : 'green'}
        />
        <StatCard
          icon={<Bot size={18} />}
          label="Active Agents"
          value={`${activeAgents}`}
          sub={`${agents.length} total configured`}
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
            SDLC Phases — Live
          </h2>
          <div className="space-y-1">
            {phases.map((phase, i) => (
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
                {phase.output && (
                  <span className="text-nexus-text-dim font-mono text-[10px] truncate max-w-40" title={phase.output}>
                    {phase.output}
                  </span>
                )}
                <span className="text-nexus-text-dim font-mono text-[10px] truncate max-w-24">{phase.agent}</span>
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
            Agent Status — Live
          </h2>
          <div className="space-y-1.5">
            {agents.map((agent, i) => (
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
                  {agent.currentPhase && (
                    <div className="text-[9px] text-nexus-amber font-mono">Phase {agent.currentPhase}</div>
                  )}
                </div>
                <div className={`w-2 h-2 rounded-full ${agentStatusColor(agent.status)}`} />
              </motion.div>
            ))}
          </div>
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
