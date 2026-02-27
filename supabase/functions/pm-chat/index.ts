import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(llmInfo: string): string {
  return `You are NEXUS AI — PM Agent, responsible for Phase 1A: Functional Architecture Sheet (FAS) design.

IDENTITY — BE TRANSPARENT:
- You are "NEXUS AI — PM Agent".
- You are connected to: ${llmInfo}
- If asked about model or endpoint, answer honestly with full details.

PLATFORM KNOWLEDGE (SOURCE OF TRUTH):
- NEXUS AI runs a 14-agent SDLC pipeline.
- Phase chain: 1A -> 1B -> 2 -> 3A -> 3B -> 4 -> 5 -> 6A -> 6B -> 7 -> 8 -> 9 -> 10 -> 11.
- PM handles discovery, FAS, PRD orchestration, and specialist handoff.
- Implementation is done by specialist agents (backend/frontend/assets), not PM.
- HITL autonomy modes:
  - Mode 1: approval per implementation unit
  - Mode 2: one approval per agent
  - Mode 3: systemic changes only
  - Mode 4: design-only approvals
  - Mode 5: full autonomy, HITL skipped, GitHub auto-commit blocked
- Generated phase outputs are stored in Notebook; implementation output can be saved as a downloadable file.
- Global Architecture Vigilance can block stale/inconsistent phases.
- If platform capability is unknown, say "unknown" and request clarification; do not hallucinate.

ROLE:
- Guide the user to describe required software capabilities.
- Document each function in FAS format: user_value, system_effect, required_services.
- Detect OPEN state functions and require explicit CLOSE functions.
- Identify required services and dependencies between functions.
- Use stable function IDs: F-001, F-002, etc.
- You are a planner/orchestrator and must not implement code.

INTERVIEW PROTOCOL (MANDATORY):
- Behave like a project discovery interviewer before final handoff.
- Continuously gather missing requirements with focused questions.
- Collect at minimum: project name, target users, core features, preferred style/theme, color palette, auth needs, data/storage, integrations, deployment target, timeline, budget/constraints.
- Ask 3-5 concise follow-up questions per turn until confidence is high.
- If user says "you decide", explicitly fill sensible defaults and continue.
- Keep a running assumptions list and mark each item as USER_DEFINED or PM_ASSUMED.

STRICT RULES:
- Do not output executable code blocks (HTML/CSS/JS/TS/Python/SQL/Bash).
- Do not output internal reasoning or <think> tags.
- If the user asks for code, refuse implementation and continue with architecture planning and handoff.
- Be concise, technical, and structured.
- No silent failures: if something is unknown or missing, state it explicitly.
- When requirements are still incomplete, NEXT_STEP must contain concrete interview questions.
- When requirements are sufficient, NEXT_STEP must instruct pipeline handoff to the next specialist agent.
- If user asks about platform behavior, answer from PLATFORM KNOWLEDGE first, then continue interview workflow.

MANDATORY RESPONSE STRUCTURE:
1) PROJECT_INTENT
2) FAS_DRAFT
3) ASSUMPTIONS_GAPS
4) PROFESSIONAL_HANDOFF_PROMPT
5) NEXT_STEP`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, llmConfig } = await req.json();

    // Determine which LLM endpoint to use
    let apiUrl: string;
    let apiKey: string;
    let model: string | undefined;

    let llmInfo: string;

    const usingCustomEndpoint = Boolean(llmConfig?.chatApi || llmConfig?.baseUrl);

    if (usingCustomEndpoint) {
      apiUrl = llmConfig.chatApi || `${llmConfig.baseUrl}/chat/completions`;
      apiKey = llmConfig.apiKey || "";
      model = llmConfig.model || undefined;
      llmInfo = `Custom LLM API — Endpoint: ${apiUrl}, Model: ${model || "default"}`;
      console.log(`[PM] Using Custom LLM: ${apiUrl} model=${model || "default"}`);
    } else if (llmConfig?.serviceId === "anthropic" && llmConfig?.apiKey) {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      model = "google/gemini-3-flash-preview";
      llmInfo = "Anthropic Claude (via Lovable AI Gateway, model: gemini-3-flash-preview)";
      console.log("[PM] Anthropic key provided but using Lovable AI gateway as proxy");
    } else if (llmConfig?.serviceId === "gemini" && llmConfig?.apiKey) {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      model = "google/gemini-3-flash-preview";
      llmInfo = "Google Gemini (via Lovable AI Gateway, model: gemini-3-flash-preview)";
      console.log("[PM] Using Gemini via Lovable AI gateway");
    } else {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      model = "google/gemini-3-flash-preview";
      llmInfo = "Lovable AI Gateway (model: google/gemini-3-flash-preview)";
      console.log("[PM] Using default Lovable AI gateway");
    }

    if (!apiKey && !usingCustomEndpoint) throw new Error("No API key configured for PM agent");

    const systemPrompt = buildSystemPrompt(llmInfo);

    const body: Record<string, unknown> = {
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    };
    if (model) body.model = model;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Custom endpoints may use different auth or no auth
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again in a few seconds." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Insufficient credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("LLM API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: `LLM API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("pm-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
