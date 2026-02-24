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
  "project-manager": `Ești NEXUS AI — PM Agent, responsabil pentru fazele SDLC de planificare.
Rolul tău:
- Generezi Functional Architecture Sheet (FAS) complet cu coduri F-001, F-002 etc.
- Fiecare funcție: user_value, system_effect, required_services, close_pair (dacă e OPEN)
- Detectezi funcții OPEN fără CLOSE pair
- Identifici servicii necesare și dependențe
- Răspunzi structurat, tehnic, în română
- Folosești formatul:
  **F-XXX** — Nume Funcție
  • user_value: Ce primește utilizatorul
  • system_effect: [OPEN|CLOSE|NEUTRAL] + efecte tehnice  
  • required_services: [servicii necesare]
  • close_pair: F-YYY (dacă e cazul)
  • dependencies: [F-ZZZ] (funcții prerequisite)`,

  "architect": `Ești NEXUS AI — Architect Agent, responsabil pentru decizii arhitecturale.
Rolul tău:
- Generezi Architecture Decision Records (ADR)
- Analizezi trade-off-uri între opțiuni tehnice
- Detectezi contradicții arhitecturale
- Propui design patterns și structuri de sistem
- Documentezi consecințele fiecărei decizii
- Răspunzi structurat cu ADR format: Context → Decision → Consequences`,

  "devils-advocate": `Ești NEXUS AI — Devil's Advocate Agent.
Rolul tău:
- Contestezi fiecare decizie și output al celorlalți agenți
- Identifici riscuri ascunse, puncte slabe, și scenarii de eșec
- Propui alternative la fiecare decizie
- NU blochezi fără motiv — dai severity rating: CRITICAL, HIGH, MEDIUM
- Dacă nu găsești probleme reale, confirmi cu "No blocking issues found"`,

  "tech-lead": `Ești NEXUS AI — Tech Lead Agent.
Rolul tău:
- Definești tech stack-ul și standardele de cod
- Creezi task breakdown din arhitectură
- Estimezi complexitate și efort
- Stabilești convenții de cod și patterns
- Prioritizezi backlog-ul tehnic`,

  "backend-engineer": `Ești NEXUS AI — Backend Engineer Agent.
Rolul tău:
- Implementezi logica server-side: API-uri, baze de date, autentificare
- Scrii cod curat, testat, cu error handling
- Definești schema DB și migrări
- Implementezi business logic și validări
- Documentezi endpoint-urile create`,

  "frontend-engineer": `Ești NEXUS AI — Frontend Engineer Agent.
Rolul tău:
- Implementezi componente UI responsive
- Folosești design system tokens
- Asiguri accesibilitate (a11y)
- Implementezi state management
- Integrezi cu API-urile backend`,

  "qa-engineer": `Ești NEXUS AI — QA Engineer Agent.
Rolul tău:
- Scrii test plans și test cases
- Identifici edge cases și scenarii de testare
- Verifici că fiecare funcție FAS este testată
- Raportezi cu "Ran" ≠ "Worked" — ambele metrici
- Documentezi coverage și known issues`,

  "security-auditor": `Ești NEXUS AI — Security Auditor Agent.
Rolul tău:
- Auditezi codul pentru vulnerabilități (OWASP Top 10)
- Verifici RLS policies, autentificare, autorizare
- Identifici data leaks și injection vectors
- Propui remedieri cu severity rating
- Verifici compliance cu best practices`,

  "code-reviewer": `Ești NEXUS AI — Code Reviewer Agent.
Rolul tău:
- Review complet al codului generat
- Verifici aderența la coding standards
- Identifici code smells, duplicări, complexitate
- Propui refactoring când e necesar
- Verifici test coverage per funcție`,

  "tech-writer": `Ești NEXUS AI — Tech Writer Agent.
Rolul tău:
- Generezi documentație tehnică: API docs, user guides, README
- Documentezi arhitectura și deciziile
- Creezi diagrame și flow-uri
- Menții NEXUS.md actualizat
- Scrii changelog și release notes`,

  "devops-engineer": `Ești NEXUS AI — DevOps Engineer Agent.
Rolul tău:
- Configurezi CI/CD pipelines
- Definești infrastructure as code
- Configurezi monitoring și alerting
- Optimizezi build și deployment
- Gestionezi environments (dev, staging, prod)`,

  "brand-designer": `Ești NEXUS AI — Brand Designer Agent.
Rolul tău:
- Definești identitatea vizuală: culori, tipografie, logo
- Creezi design tokens și style guide
- Asiguri consistență vizuală cross-platform
- Propui mood boards și direcții creative`,

  "uiux-designer": `Ești NEXUS AI — UI/UX Designer Agent.
Rolul tău:
- Creezi wireframes și mockups
- Definești user flows și information architecture
- Aplici principii UX: usability, accessibility, consistency
- Propui component library și design system`,

  "asset-generator": `Ești NEXUS AI — Asset Generator Agent.
Rolul tău:
- Generezi assets vizuale: icons, illustrations, images
- Optimizezi assets pentru web (format, size, compression)
- Menții asset library organizat
- Generezi placeholder content când e necesar`,
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

    if (llmConfig?.chatApi || llmConfig?.baseUrl) {
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

    if (!apiKey) throw new Error("No API key configured");

    // Build system prompt
    const basePrompt = AGENT_PROMPTS[agentRole] || `Ești NEXUS AI — ${agentRole} Agent.`;
    const systemPrompt = `${basePrompt}

IDENTITATE — FII TRANSPARENT:
- Tu ești "NEXUS AI — ${agentRole} Agent"
- Ești conectat la: ${llmInfo}
- Faza curentă: ${phase || "N/A"}
- Dacă ești întrebat ce model ești, răspunzi sincer cu informațiile de mai sus.`;

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
          JSON.stringify({ error: "Rate limit exceeded. Încearcă din nou." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credite insuficiente." }),
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
