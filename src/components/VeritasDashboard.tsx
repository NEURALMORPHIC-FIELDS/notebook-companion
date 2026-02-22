import { motion } from "framer-motion";
import { MOCK_MODULES } from "@/data/nexus-data";
import { Shield, CheckCircle, XCircle, AlertTriangle, FileText, Settings } from "lucide-react";

export default function VeritasDashboard() {
  const wired = MOCK_MODULES.filter(m => m.category === 'WIRED');
  const notWired = MOCK_MODULES.filter(m => m.category === 'NOT_WIRED');
  const tests = MOCK_MODULES.filter(m => m.category === 'TEST');
  const configs = MOCK_MODULES.filter(m => m.category === 'CONFIG');
  const criticalMissing = notWired.filter(m => m.isCritical);
  const exitCode = criticalMissing.length > 0 ? 1 : 0;
  const total = MOCK_MODULES.length;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold nexus-gradient-text">Veritas Ground Truth System</h1>
        <p className="text-sm text-muted-foreground mt-1">Module wiring audit — numbers come from the script, not from narrative.</p>
      </div>

      {/* Exit Code Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-lg p-4 border ${
          exitCode === 0
            ? 'bg-nexus-green-dim/30 border-nexus-green/30'
            : 'bg-nexus-red-dim/30 border-nexus-red/30'
        }`}
      >
        <div className="flex items-center gap-3">
          {exitCode === 0 ? (
            <CheckCircle size={24} className="text-nexus-green" />
          ) : (
            <XCircle size={24} className="text-nexus-red" />
          )}
          <div>
            <div className="font-mono font-bold text-lg text-foreground">
              EXIT CODE: {exitCode}
            </div>
            <div className="text-sm text-muted-foreground">
              {exitCode === 0
                ? `All critical modules are WIRED`
                : `${criticalMissing.length} critical modules NOT_WIRED — Agent cannot declare phase COMPLETE`
              }
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 font-mono">
        <MiniStat label="WIRED" count={wired.length} total={total} color="text-nexus-green" />
        <MiniStat label="NOT_WIRED" count={notWired.length} total={total} color="text-nexus-red" />
        <MiniStat label="TEST" count={tests.length} total={total} color="text-nexus-blue" />
        <MiniStat label="CONFIG" count={configs.length} total={total} color="text-nexus-text-dim" />
      </div>

      {/* Sanity Gate */}
      <div className="nexus-card rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield size={14} className="text-primary" />
          Sanity Gate — Pre-HITL Block
        </h2>
        <div className={`rounded-md p-3 border text-sm ${
          exitCode === 0
            ? 'bg-nexus-green-dim/20 border-nexus-green/20 text-nexus-green'
            : 'bg-nexus-red-dim/20 border-nexus-red/20 text-nexus-red'
        }`}>
          {exitCode === 0
            ? '✓ Sanity Gate OPEN — HITL approval panel accessible'
            : `✗ Sanity Gate BLOCKED — ${criticalMissing.length} CRITICAL modules NOT_WIRED. Agent MUST remediate before HITL opens.`
          }
        </div>
      </div>

      {/* Critical Missing */}
      {criticalMissing.length > 0 && (
        <div className="nexus-card rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-nexus-amber" />
            Critical Modules NOT_WIRED
          </h2>
          <div className="space-y-1">
            {criticalMissing.map(m => (
              <div key={m.name} className="flex items-center gap-2 px-3 py-2 rounded bg-nexus-red-dim/20 border border-nexus-red/20 text-xs font-mono">
                <XCircle size={12} className="text-nexus-red flex-shrink-0" />
                <span className="text-foreground">{m.path}</span>
                <span className="text-muted-foreground ml-auto">CRITICAL</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Module Matrix */}
      <div className="nexus-card rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText size={14} className="text-primary" />
          Complete Module Classification
        </h2>
        <div className="overflow-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-nexus-border-subtle">
                <th className="text-left py-2 px-3">Module</th>
                <th className="text-left py-2 px-3">Path</th>
                <th className="text-left py-2 px-3">Category</th>
                <th className="text-left py-2 px-3">Critical</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_MODULES.map((m, i) => (
                <motion.tr
                  key={m.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-nexus-border-subtle/50 hover:bg-nexus-surface-hover"
                >
                  <td className="py-1.5 px-3 text-secondary-foreground">{m.name}</td>
                  <td className="py-1.5 px-3 text-muted-foreground">{m.path}</td>
                  <td className="py-1.5 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      m.category === 'WIRED' ? 'bg-nexus-green-dim text-nexus-green'
                      : m.category === 'NOT_WIRED' ? 'bg-nexus-red-dim text-nexus-red'
                      : m.category === 'TEST' ? 'bg-nexus-blue/20 text-nexus-blue'
                      : 'bg-muted text-muted-foreground'
                    }`}>
                      {m.category}
                    </span>
                  </td>
                  <td className="py-1.5 px-3">
                    {m.isCritical && <AlertTriangle size={12} className="text-nexus-amber" />}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div className="nexus-card rounded-lg p-3">
      <div className={`text-2xl font-bold ${color}`}>{count}</div>
      <div className="text-[10px] text-muted-foreground">{label} ({pct}%)</div>
      <div className="mt-2 h-1 rounded bg-muted overflow-hidden">
        <div className={`h-full rounded ${color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
