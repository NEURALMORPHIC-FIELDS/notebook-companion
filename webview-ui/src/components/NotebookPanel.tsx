import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Plus, Trash2, CheckCircle, XCircle, Terminal, FileCode } from "lucide-react";

interface NotebookCell {
  id: number;
  code: string;
  output: string | null;
  status: 'idle' | 'running' | 'success' | 'error';
}

const INITIAL_CELLS: NotebookCell[] = [
  {
    id: 1,
    code: `# verify_integration.py — Veritas Ground Truth
# Entry point: run_sim.py
# Scans: core, agents, adapters, integrations, api, simulation_server
# Classifies: WIRED | NOT_WIRED | TEST | CONFIG

from verify_integration import main
exit_code = main()
print(f"Exit code: {exit_code}")`,
    output: `[INFO] Scanned 31 Python modules
[INFO] Found 12 transitively imported modules
======================================================================
  VERIFY INTEGRATION REPORT
======================================================================
  Total modules scanned: 31
  WIRED:       12  (39%)
  NOT_WIRED:   12  (39%)
  TEST:         5  (16%)
  CONFIG:       2  ( 6%)
----------------------------------------------------------------------

  [CRITICAL] 8 critical modules NOT WIRED:
    - core/features/registry.py
    - core/orchestrator/llm_router.py
    - core/orchestrator/arbitrator.py
    - core/cognition/constellation_db.py
    - core/cognition/inverse_projection.py
    - core/cognition/conviction_engine.py
    - core/cognition/outcome_tracker.py
    - agents/alpha_agent.py
======================================================================
EXIT CODE: 1 (8 critical modules missing)
Agent cannot declare phase COMPLETE until all CRITICAL are WIRED.`,
    status: 'error',
  },
  {
    id: 2,
    code: `# AST Import Extractor — check wiring for a single module
import ast

def extract_imports(filepath):
    """Extract all imported module names from a Python file using AST."""
    with open(filepath) as f:
        tree = ast.parse(f.read())
    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append(node.module)
    return imports

# Check run_sim.py entry point
imports = extract_imports('run_sim.py')
print(f"run_sim.py imports ({len(imports)} modules):")
for imp in sorted(imports):
    print(f"  → {imp}")`,
    output: `run_sim.py imports (6 modules):
  → core.data.ingestion
  → core.data.normalizer
  → core.events
  → core.execution.oms
  → core.risk.pre_trade
  → core.strategy.trend`,
    status: 'success',
  },
  {
    id: 3,
    code: `# Check critical modules status
CRITICAL = {
    "core/features/registry.py",
    "core/orchestrator/llm_router.py",
    "core/orchestrator/arbitrator.py",
    "core/cognition/constellation_db.py",
    "core/cognition/inverse_projection.py",
    "core/cognition/conviction_engine.py",
    "core/cognition/outcome_tracker.py",
    "agents/alpha_agent.py",
}

print(f"Critical NOT_WIRED: {len(CRITICAL)}/20")
print(f"Wired critical:     12/20")
print(f"Coverage:           60%")
print()
print("⚠ Agent BLOCKED — cannot advance past Phase 6A")`,
    output: null,
    status: 'idle',
  },
];

export default function NotebookPanel() {
  const [cells, setCells] = useState<NotebookCell[]>(INITIAL_CELLS);

  const runCell = (id: number) => {
    setCells(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'running' } : c
    ));
    setTimeout(() => {
      setCells(prev => prev.map(c =>
        c.id === id ? { ...c, status: c.output ? (c.id === 1 ? 'error' : 'success') : 'success', output: c.output || '>>> OK (no output)' } : c
      ));
    }, 800);
  };

  const addCell = () => {
    setCells(prev => [...prev, {
      id: Date.now(),
      code: '',
      output: null,
      status: 'idle',
    }]);
  };

  const deleteCell = (id: number) => {
    setCells(prev => prev.filter(c => c.id !== id));
  };

  const updateCode = (id: number, code: string) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, code } : c));
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold nexus-gradient-text">Notebook</h1>
          <p className="text-sm text-muted-foreground mt-1">Rulare cod și teste — integrat cu Veritas Ground Truth</p>
        </div>
        <button
          onClick={addCell}
          className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-xs hover:bg-nexus-surface-hover transition-colors"
        >
          <Plus size={14} /> Add Cell
        </button>
      </div>

      {cells.map((cell, i) => (
        <motion.div
          key={cell.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`nexus-card rounded-lg overflow-hidden ${
            cell.status === 'error' ? 'border-nexus-red/30' : cell.status === 'success' ? 'border-nexus-green/30' : ''
          }`}
        >
          {/* Cell Header */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-nexus-surface-hover border-b border-nexus-border-subtle">
            <FileCode size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground">Cell [{i + 1}]</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => runCell(cell.id)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-nexus-green-dim text-nexus-green hover:bg-nexus-green/20 transition-colors"
              >
                <Play size={10} /> Run
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
            placeholder="# Write Python code here..."
            rows={cell.code.split('\n').length + 1}
          />

          {/* Output */}
          {cell.output && (
            <div className={`border-t px-4 py-3 font-mono text-xs whitespace-pre-wrap ${
              cell.status === 'error'
                ? 'bg-nexus-red-dim/10 border-nexus-red/20 text-nexus-red'
                : 'bg-nexus-green-dim/10 border-nexus-green/20 text-nexus-green'
            }`}>
              <div className="flex items-center gap-1.5 mb-2 text-[10px]">
                {cell.status === 'error' ? <XCircle size={10} /> : <CheckCircle size={10} />}
                <span>{cell.status === 'error' ? 'Exit Code: 1' : 'Exit Code: 0'}</span>
              </div>
              {cell.output}
            </div>
          )}

          {cell.status === 'running' && (
            <div className="border-t border-nexus-border-subtle px-4 py-3 flex items-center gap-2">
              <Terminal size={12} className="text-nexus-amber animate-pulse" />
              <span className="text-[10px] font-mono text-nexus-amber">Running...</span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
