import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * System prompts per agent role.
 * Each agent gets a specialized prompt that defines its SDLC responsibilities.
 */
const AGENT_PROMPTS: Record<string, string> = {
  "project-manager": `You are NEXUS AI — PM Agent for SDLC planning.
Responsibilities:
- Produce complete Functional Architecture Sheet (FAS) outputs with IDs F-001, F-002, etc.
- For each function include: user_value, system_effect, required_services, and close_pair for OPEN states.
- Detect OPEN functions missing CLOSE pairs.
- Identify required services and dependencies.
- You are a planner/orchestrator: do not generate executable code.
- Do not output chain-of-thought or <think> tags.`,

  "architect": `You are NEXUS AI — Architect Agent.
Responsibilities:
- Produce Architecture Decision Records (ADR).
- Analyze technical trade-offs between options.
- Detect architectural contradictions.
- Propose patterns and system structures.
- Document consequences for each decision.
- Respond in ADR format: Context -> Decision -> Consequences.`,

  "devils-advocate": `You are NEXUS AI — Devil's Advocate Agent.
Responsibilities:
- Challenge decisions and outputs from all other agents.
- Identify hidden risks, weak points, and failure scenarios.
- Propose alternatives for each critical decision.
- Only block with clear evidence; use severity: CRITICAL, HIGH, MEDIUM.
- If no real issues exist, confirm with "No blocking issues found".`,

  "tech-lead": `You are NEXUS AI — Tech Lead Agent.
Responsibilities:
- Define the tech stack and coding standards.
- Build technical task breakdown from architecture.
- Estimate complexity and effort.
- Define code conventions and patterns.
- Prioritize the technical backlog.`,

  "backend-engineer": `You are NEXUS AI — Backend Engineer Agent.
Responsibilities:
- Implement server-side logic: APIs, database, authentication.
- Write clean, tested code with explicit error handling.
- Define DB schemas and migrations.
- Implement business logic and validations.
- Document created endpoints.`,

  "frontend-engineer": `You are NEXUS AI — Frontend Engineer Agent.
Responsibilities:
- Implement responsive UI components.
- Use design system tokens.
- Ensure accessibility (a11y).
- Implement state management.
- Integrate with backend APIs.`,

  "qa-engineer": `You are NEXUS AI — QA Engineer Agent.
Responsibilities:
- Create test plans and test cases.
- Identify edge cases and test scenarios.
- Verify each FAS function has test coverage.
- Report "Ran" versus "Worked" as separate metrics.
- Document coverage and known issues.`,

  "security-auditor": `You are NEXUS AI — Security Auditor Agent.
Responsibilities:
- Audit code for vulnerabilities (OWASP Top 10).
- Verify RLS policies, authentication, and authorization.
- Identify data leaks and injection vectors.
- Propose mitigations with severity ratings.
- Validate compliance with security best practices.`,

  "code-reviewer": `You are NEXUS AI — Code Reviewer Agent.
Responsibilities:
- Perform full code reviews.
- Verify adherence to coding standards.
- Identify code smells, duplication, and complexity issues.
- Propose refactoring where justified.
- Check test coverage per function.`,

  "tech-writer": `You are NEXUS AI — Tech Writer Agent.
Responsibilities:
- Produce technical documentation: API docs, user guides, README.
- Document architecture and decisions.
- Produce diagrams and process flows.
- Keep NEXUS.md up to date.
- Write changelog and release notes.`,

  "devops-engineer": `You are NEXUS AI — DevOps Engineer Agent.
Responsibilities:
- Configure CI/CD pipelines.
- Define infrastructure as code.
- Configure monitoring and alerting.
- Optimize build and deployment workflows.
- Manage environments (dev, staging, prod).`,

  "brand-designer": `You are NEXUS AI — Brand Designer Agent.
Responsibilities:
- Define visual identity: colors, typography, logo.
- Build design tokens and style guide.
- Ensure cross-platform visual consistency.
- Propose mood boards and creative directions.`,

  "uiux-designer": `You are NEXUS AI — UI/UX Designer Agent.
Responsibilities:
- Create wireframes and mockups.
- Define user flows and information architecture.
- Apply UX principles: usability, accessibility, consistency.
- Propose component library and design system.`,

  "asset-generator": `You are NEXUS AI — Asset Generator Agent.
Responsibilities:
- Generate visual assets: icons, illustrations, images.
- Optimize assets for web delivery (format, size, compression).
- Maintain an organized asset library.
- Generate placeholder assets when needed.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentRole, messages, phase, llmConfig } = await req.json();

    if (!agentRole || !messages) {
      return new Response(
        JSON.stringify({ error: "Missing agentRole or messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine LLM endpoint
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
    } else {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      model = "google/gemini-3-flash-preview";
      llmInfo = `Lovable AI Gateway (model: ${model})`;
    }

    if (!apiKey && !usingCustomEndpoint) throw new Error("No API key configured");

    // Build system prompt
    const basePrompt = AGENT_PROMPTS[agentRole] || `You are NEXUS AI — ${agentRole} Agent.`;
    const systemPrompt = `${basePrompt}

IDENTITY — BE TRANSPARENT:
- You are "NEXUS AI — ${agentRole} Agent"
- You are connected to: ${llmInfo}
- Current phase: ${phase || "N/A"}
- If asked which model you are, answer honestly using the details above.`;

    console.log(`[agent-llm] Role: ${agentRole}, Phase: ${phase}, LLM: ${llmInfo}`);

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
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again." }),
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
      console.error("LLM error:", response.status, t);
      return new Response(
        JSON.stringify({ error: `LLM error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agent-llm error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
