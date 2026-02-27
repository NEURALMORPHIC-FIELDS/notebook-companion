import {
  Kanban, Blocks, Flame, Cpu, Server, Monitor,
  FlaskConical, ShieldCheck, ScanEye, BookOpen,
  Rocket, Gem, PenTool, Image
} from "lucide-react";
import type { LucideProps } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  kanban: Kanban,
  blocks: Blocks,
  flame: Flame,
  cpu: Cpu,
  server: Server,
  monitor: Monitor,
  "flask-conical": FlaskConical,
  "shield-check": ShieldCheck,
  "scan-eye": ScanEye,
  "book-open": BookOpen,
  rocket: Rocket,
  gem: Gem,
  "pen-tool": PenTool,
  image: Image,
};

interface AgentIconProps {
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg";
}

export default function AgentIcon({ icon, color, size = "md" }: AgentIconProps) {
  const Icon = ICON_MAP[icon];
  if (!Icon) return null;

  const sizeMap = {
    sm: { container: "w-7 h-7", icon: 14 },
    md: { container: "w-9 h-9", icon: 18 },
    lg: { container: "w-11 h-11", icon: 22 },
  };

  const s = sizeMap[size];

  return (
    <div className={`${s.container} rounded-xl flex items-center justify-center bg-${color}/15 text-${color} ring-1 ring-${color}/20 flex-shrink-0`}>
      <Icon size={s.icon} />
    </div>
  );
}
