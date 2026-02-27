import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Shield, CheckCircle, XCircle, AlertTriangle, FileText, Play, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { orchestratorStore } from "@/stores/OrchestratorStore";
import { VeritasRunner, type VeritasReport } from "@/veritas/VeritasRunner";
import { APP_CRITICAL_MODULES } from "@/veritas/AppCriticalModules";
import { PROJECT_MODULE_INVENTORY } from "@/veritas/ProjectModuleInventory";

const VERITAS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/veritas-runner`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const VERITAS_MODULE_STORAGE_KEY = "nexus-veritas-modules";

interface VeritasModule {
  name: string;
  path: string;
  category: "WIRED" | "NOT_WIRED" | "TEST" | "CONFIG";
  isCritical?: boolean;
}

interface VeritasResponse {
  exitCode?: number;
  report?: VeritasReport;
  modules?: VeritasModule[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function getProjectModules(): string[] {
  return [...PROJECT_MODULE_INVENTORY]
    .map((path) => normalizePath(path))
    .sort((left, right) => left.localeCompare(right));
}

function toDisplayTime(timestamp: string | undefined): string | null {
  if (!timestamp) {
    return null;
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleTimeString();
}

function loadStoredModules(): VeritasModule[] {
  try {
    const raw = localStorage.getItem(VERITAS_MODULE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is VeritasModule =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as { name?: unknown }).name === "string" &&
        typeof (item as { path?: unknown }).path === "string" &&
        ["WIRED", "NOT_WIRED", "TEST", "CONFIG"].includes(String((item as { category?: unknown }).category))
      )
    );
  } catch {
    return [];
  }
}

function persistModules(modules: VeritasModule[]): void {
  try {
    localStorage.setItem(VERITAS_MODULE_STORAGE_KEY, JSON.stringify(modules));
  } catch {
    // Ignore localStorage quota issues at runtime.
  }
}

export default function VeritasDashboard() {
  const savedReport = VeritasRunner.loadReport();
  const [modules, setModules] = useState<VeritasModule[]>(loadStoredModules());
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(toDisplayTime(savedReport?.timestamp));
  const [liveResult, setLiveResult] = useState<boolean>(Boolean(savedReport));

  const moduleMatrix = useMemo(() => {
    const categoryRank: Record<VeritasModule["category"], number> = {
      NOT_WIRED: 0,
      WIRED: 1,
      TEST: 2,
      CONFIG: 3,
    };
    return [...modules].sort((left, right) => {
      const rankDiff = categoryRank[left.category] - categoryRank[right.category];
      if (rankDiff !== 0) {
        return rankDiff;
      }
      if (Boolean(left.isCritical) !== Boolean(right.isCritical)) {
        return left.isCritical ? -1 : 1;
      }
      return left.path.localeCompare(right.path);
    });
  }, [modules]);

  const runVeritas = async () => {
    const projectModules = getProjectModules();
    if (projectModules.length === 0) {
      toast.error("Unable to build module inventory for Veritas analysis.");
      return;
    }

    setRunning(true);
    try {
      const resp = await fetch(VERITAS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          criticalModules: APP_CRITICAL_MODULES,
          projectModules,
          verbose: true,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Veritas runner HTTP ${resp.status}`);
      }

      const data = await resp.json() as VeritasResponse;

      if (data.report) {
        VeritasRunner.saveReport(data.report);
      }

      if (Array.isArray(data.modules)) {
        setModules(data.modules);
        persistModules(data.modules);
      }

      const exitCode = data.report?.exit_code
        ?? data.exitCode
        ?? (data.modules?.some((module) => module.category === "NOT_WIRED" && module.isCritical) ? 1 : 0);

      orchestratorStore.setVeritasExitCode(exitCode);
      setLastRun(new Date().toLocaleTimeString());
      setLiveResult(true);
      toast.success(`Veritas complete — exit ${exitCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Veritas failed");
    } finally {
      setRunning(false);
    }
  };

  const wired = moduleMatrix.filter((module) => module.category === "WIRED");
  const notWired = moduleMatrix.filter((module) => module.category === "NOT_WIRED");
  const tests = moduleMatrix.filter((module) => module.category === "TEST");
  const configs = moduleMatrix.filter((module) => module.category === "CONFIG");
  const criticalMissing = notWired.filter((module) => module.isCritical);
  const exitCode = criticalMissing.length > 0 ? 1 : 0;
  const total = moduleMatrix.length;
  const projectModuleCount = getProjectModules().length;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold nexus-gradient-text">Veritas Ground Truth System</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Module wiring audit from live project inventory ({projectModuleCount} discovered modules).
            {lastRun && <span className="ml-2 text-nexus-green font-mono text-[10px]">Last run: {lastRun}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {liveResult && (
            <span className="text-[9px] font-mono px-2 py-1 rounded-full bg-nexus-green/10 text-nexus-green border border-nexus-green/20">
              LIVE DATA
            </span>
          )}
          <button
            onClick={runVeritas}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {running
              ? <><Loader2 size={13} className="animate-spin" /> Running...</>
              : lastRun
                ? <><RefreshCw size={13} /> Re-run Veritas</>
                : <><Play size={13} /> Run Veritas</>
            }
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-lg p-4 border ${exitCode === 0
          ? "bg-nexus-green-dim/30 border-nexus-green/30"
          : "bg-nexus-red-dim/30 border-nexus-red/30"
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
                ? "All critical modules are WIRED"
                : `${criticalMissing.length} critical modules NOT_WIRED — Agent cannot declare phase COMPLETE`
              }
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-4 gap-4 font-mono">
        <MiniStat label="WIRED" count={wired.length} total={total} color="text-nexus-green" />
        <MiniStat label="NOT_WIRED" count={notWired.length} total={total} color="text-nexus-red" />
        <MiniStat label="TEST" count={tests.length} total={total} color="text-nexus-blue" />
        <MiniStat label="CONFIG" count={configs.length} total={total} color="text-nexus-text-dim" />
      </div>

      <div className="nexus-card rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield size={14} className="text-primary" />
          Sanity Gate — Pre-HITL Block
        </h2>
        <div className={`rounded-md p-3 border text-sm ${exitCode === 0
          ? "bg-nexus-green-dim/20 border-nexus-green/20 text-nexus-green"
          : "bg-nexus-red-dim/20 border-nexus-red/20 text-nexus-red"
          }`}>
          {exitCode === 0
            ? "✓ Sanity Gate OPEN — HITL approval panel accessible"
            : `✗ Sanity Gate BLOCKED — ${criticalMissing.length} CRITICAL modules NOT_WIRED. Agent MUST remediate before HITL opens.`
          }
        </div>
      </div>

      {criticalMissing.length > 0 && (
        <div className="nexus-card rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-nexus-amber" />
            Critical Modules NOT_WIRED
          </h2>
          <div className="space-y-1">
            {criticalMissing.map((module) => (
              <div key={module.path} className="flex items-center gap-2 px-3 py-2 rounded bg-nexus-red-dim/20 border border-nexus-red/20 text-xs font-mono">
                <XCircle size={12} className="text-nexus-red flex-shrink-0" />
                <span className="text-foreground">{module.path}</span>
                <span className="text-muted-foreground ml-auto">CRITICAL</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="nexus-card rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText size={14} className="text-primary" />
          Complete Module Classification
        </h2>
        {moduleMatrix.length === 0 ? (
          <div className="text-xs text-muted-foreground px-2 py-4">
            No classification data available yet. Run Veritas to build a live module matrix.
          </div>
        ) : (
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
                {moduleMatrix.map((module, index) => (
                  <motion.tr
                    key={`${module.path}-${module.category}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.01 }}
                    className="border-b border-nexus-border-subtle/50 hover:bg-nexus-surface-hover"
                  >
                    <td className="py-1.5 px-3 text-secondary-foreground">{module.name}</td>
                    <td className="py-1.5 px-3 text-muted-foreground">{module.path}</td>
                    <td className="py-1.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${module.category === "WIRED" ? "bg-nexus-green-dim text-nexus-green"
                        : module.category === "NOT_WIRED" ? "bg-nexus-red-dim text-nexus-red"
                          : module.category === "TEST" ? "bg-nexus-blue/20 text-nexus-blue"
                            : "bg-muted text-muted-foreground"
                        }`}>
                        {module.category}
                      </span>
                    </td>
                    <td className="py-1.5 px-3">
                      {module.isCritical && <AlertTriangle size={12} className="text-nexus-amber" />}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="nexus-card rounded-lg p-3">
      <div className={`text-2xl font-bold ${color}`}>{count}</div>
      <div className="text-[10px] text-muted-foreground">{label} ({pct}%)</div>
      <div className="mt-2 h-1 rounded bg-muted overflow-hidden">
        <div className={`h-full rounded ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
