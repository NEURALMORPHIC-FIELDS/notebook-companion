import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Key, Check, AlertCircle } from "lucide-react";
import {
  AGENT_SERVICES,
  CUSTOM_LLM_BASE_URL,
  CUSTOM_LLM_CHAT_API,
  CUSTOM_LLM_MODEL,
  type AgentApiConfig,
  type AgentService,
} from "@/data/agent-services";
import type { Agent } from "@/data/nexus-data";
import AgentIcon from "@/components/AgentIcon";

interface AgentConfigPopoverProps {
  agent: Agent;
  configs: AgentApiConfig[];
  onSave: (agentId: string, configs: AgentApiConfig[]) => void;
  children: React.ReactNode;
}

export default function AgentConfigPopover({ agent, configs, onSave, children }: AgentConfigPopoverProps) {
  const services = AGENT_SERVICES[agent.id] || [];
  const [localConfigs, setLocalConfigs] = useState<Record<string, AgentApiConfig>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");

  useEffect(() => {
    const map: Record<string, AgentApiConfig> = {};
    configs.forEach(c => { map[c.serviceId] = c; });
    setLocalConfigs(map);
  }, [configs]);

  const connectedCount = Object.values(localConfigs).filter(c => c.enabled && c.apiKey).length;

  const saveConfigs = (updated: Record<string, AgentApiConfig>) => {
    setLocalConfigs(updated);
    onSave(agent.id, Object.values(updated));
  };

  const handleToggle = (service: AgentService, enabled: boolean) => {
    const existing = localConfigs[service.id];
    saveConfigs({
      ...localConfigs,
      [service.id]: {
        serviceId: service.id,
        apiKey: existing?.apiKey || "",
        baseUrl: existing?.baseUrl || "",
        chatApi: existing?.chatApi || "",
        model: existing?.model || "",
        enabled,
      },
    });
  };

  const handleSaveKey = (serviceId: string) => {
    const existing = localConfigs[serviceId];
    saveConfigs({
      ...localConfigs,
      [serviceId]: {
        serviceId,
        apiKey: keyInput,
        baseUrl: existing?.baseUrl || "",
        chatApi: existing?.chatApi || "",
        model: existing?.model || "",
        enabled: true,
      },
    });
    setEditingKey(null);
    setKeyInput("");
  };

  const handleCustomField = (serviceId: string, field: "baseUrl" | "chatApi" | "model", value: string) => {
    const existing = localConfigs[serviceId];
    saveConfigs({
      ...localConfigs,
      [serviceId]: {
        serviceId,
        apiKey: existing?.apiKey || "",
        baseUrl: existing?.baseUrl || "",
        chatApi: existing?.chatApi || "",
        model: existing?.model || "",
        enabled: existing?.enabled ?? true,
        [field]: value,
      },
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 bg-popover border border-border"
        align="start"
        side="right"
        sideOffset={8}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <AgentIcon icon={agent.icon} color={agent.color} size="md" />
            <div>
              <h3 className="text-sm font-bold text-foreground">{agent.name}</h3>
              <p className="text-[11px] text-muted-foreground">{agent.role}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono">
            {connectedCount > 0 ? (
              <span className="flex items-center gap-1 text-nexus-green">
                <Check size={10} /> {connectedCount} service{connectedCount > 1 ? 's' : ''} connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle size={10} /> No services configured
              </span>
            )}
          </div>
        </div>

        {/* Services List */}
        <div className="max-h-[420px] overflow-y-auto">
          {services.map((service) => {
            const cfg = localConfigs[service.id];
            const hasKey = !!(cfg?.apiKey);
            const isEnabled = !!(cfg?.enabled);
            const isCustom = service.id === "custom";

            return (
              <div
                key={service.id}
                className="px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{service.name}</span>
                      {isEnabled && (hasKey || (isCustom && cfg?.baseUrl)) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-nexus-green" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      {service.description}
                    </p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(service, checked)}
                    className="scale-75"
                  />
                </div>

                {/* When enabled — show key input or custom URL fields */}
                {isEnabled && (
                  <div className="mt-2 flex flex-col gap-2">

                    {/* API Key row — shown for all services (optional for custom) */}
                    {editingKey === service.id ? (
                      <div className="flex gap-1.5">
                        <input
                          type="password"
                          value={keyInput}
                          onChange={(e) => setKeyInput(e.target.value)}
                          placeholder={service.placeholder}
                          className="flex-1 h-7 px-2 text-[11px] font-mono bg-muted border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && keyInput.trim()) handleSaveKey(service.id);
                            if (e.key === 'Escape') { setEditingKey(null); setKeyInput(""); }
                          }}
                        />
                        <button
                          onClick={() => keyInput.trim() && handleSaveKey(service.id)}
                          className="h-7 px-2 text-[10px] font-mono font-bold rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                        >
                          SAVE
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingKey(service.id); setKeyInput(cfg?.apiKey || ""); }}
                          className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Key size={9} />
                          {hasKey ? "••••••••" + cfg.apiKey.slice(-4) : "Add API key"}
                        </button>
                        {!isCustom && (
                          <a
                            href={service.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Custom endpoint fields — shown ONLY for the 'custom' service */}
                    {isCustom && (
                      <div className="pt-2 border-t border-border/40 flex flex-col gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Base URL</label>
                          <input
                            type="text"
                            value={cfg?.baseUrl || ""}
                            onChange={(e) => handleCustomField(service.id, "baseUrl", e.target.value)}
                            placeholder={CUSTOM_LLM_BASE_URL}
                            className="w-full h-6 px-2 text-[10px] font-mono bg-muted/50 border border-border rounded text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Chat API Endpoint</label>
                          <input
                            type="text"
                            value={cfg?.chatApi || ""}
                            onChange={(e) => handleCustomField(service.id, "chatApi", e.target.value)}
                            placeholder={CUSTOM_LLM_CHAT_API}
                            className="w-full h-6 px-2 text-[10px] font-mono bg-muted/50 border border-border rounded text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Model</label>
                          <input
                            type="text"
                            value={cfg?.model || ""}
                            onChange={(e) => handleCustomField(service.id, "model", e.target.value)}
                            placeholder={CUSTOM_LLM_MODEL}
                            className="w-full h-6 px-2 text-[10px] font-mono bg-muted/50 border border-border rounded text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
