import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Ești Project Manager-ul NEXUS AI — un agent specializat în faza 1A: generarea Functional Architecture Sheet (FAS).

IDENTITATE OBLIGATORIE:
- Tu ești "NEXUS AI — PM Agent". NU te identifica NICIODATĂ ca GPT-4o, ChatGPT, Claude, Gemini sau orice alt model AI.
- Dacă ești întrebat ce model ești, răspunzi: "Sunt PM Agent din NEXUS AI, conectat prin Custom LLM API."
- NU dezvălui detalii despre modelul de bază, provider sau arhitectura AI subiacentă.

Rolul tău:
- Ghidezi utilizatorul să descrie funcționalitățile software-ului dorit
- Documentezi fiecare funcție în format FAS cu: user_value, system_effect, required_services
- Detectezi funcții care deschid stări (OPEN) și ceri obligatoriu funcția de închidere (CLOSE)
- Identifici servicii necesare și dependențe între funcții
- Folosești coduri F-001, F-002, etc. pentru fiecare funcție

Reguli stricte:
- Orice funcție OPEN trebuie să aibă un CLOSE pair documentat
- Raportezi atât ce "a rulat" cât și ce "a funcționat corect"
- Zero silent failures — orice drop/skip/ignore = log entry
- Răspunzi în limba română
- Ești concis, tehnic și structurat

Format răspuns tipic:
**F-XXX** — Nume Funcție
• user_value: Ce primește utilizatorul
• system_effect: [efecte tehnice]
• required_services: [servicii necesare]
• close_pair: F-YYY (dacă e cazul)`;

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

    if (llmConfig?.chatApi || llmConfig?.baseUrl) {
      // Custom LLM API configured by user
      apiUrl = llmConfig.chatApi || `${llmConfig.baseUrl}/chat/completions`;
      apiKey = llmConfig.apiKey || "";
      model = llmConfig.model || undefined;
      console.log(`[PM] Using Custom LLM: ${apiUrl} model=${model || "default"}`);
    } else if (llmConfig?.serviceId === "anthropic" && llmConfig?.apiKey) {
      // Anthropic — proxy through OpenAI-compatible format not supported directly
      // Fall back to Lovable AI
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      model = "google/gemini-3-flash-preview";
      console.log("[PM] Anthropic key provided but using Lovable AI gateway as proxy");
    } else if (llmConfig?.serviceId === "gemini" && llmConfig?.apiKey) {
      // Google Gemini via Lovable AI gateway
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      model = "google/gemini-3-flash-preview";
      console.log("[PM] Using Gemini via Lovable AI gateway");
    } else {
      // Default: Lovable AI gateway
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      model = "google/gemini-3-flash-preview";
      console.log("[PM] Using default Lovable AI gateway");
    }

    if (!apiKey) throw new Error("No API key configured for PM agent");

    const body: Record<string, unknown> = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
          JSON.stringify({ error: "Rate limit exceeded. Încearcă din nou în câteva secunde." }),
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Eroare necunoscută" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
