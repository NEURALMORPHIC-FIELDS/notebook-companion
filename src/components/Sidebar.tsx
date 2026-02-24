import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Shield, Bot, FileText, Terminal, ChevronLeft,
  ChevronRight, Zap, Settings, Radio
} from "lucide-react";

type View = 'dashboard' | 'veritas' | 'agents' | 'chat' | 'notebook';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'veritas', label: 'Veritas', icon: <Shield size={18} /> },
  { id: 'agents', label: 'Agents', icon: <Bot size={18} /> },
  { id: 'chat', label: 'FAS Chat', icon: <FileText size={18} /> },
  { id: 'notebook', label: 'Notebook', icon: <Terminal size={18} /> },
];

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2 }}
      className="h-screen flex flex-col bg-nexus-deep border-r border-nexus-border-subtle backdrop-blur-xl"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-nexus-border-subtle">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 p-0.5 overflow-hidden">
          <img src="/nexus-logo.png" alt="Nexus AI Logo" className="w-full h-full object-contain" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden"
            >
              <span className="font-bold text-foreground text-sm tracking-wide">NEXUS AI</span>
              <span className="text-[10px] text-muted-foreground block -mt-0.5 font-mono">v6.0</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${isActive
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm shadow-primary/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-nexus-surface-hover border border-transparent'
                }`}
            >
              <span className={isActive ? 'text-primary' : ''}>{item.icon}</span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Status indicator */}
      <div className="px-3 py-2 border-t border-nexus-border-subtle">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio size={12} className="text-nexus-green animate-pulse-glow" />
          {!collapsed && <span>System Online</span>}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-nexus-border-subtle text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  );
}
