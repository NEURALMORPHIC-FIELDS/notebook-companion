import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Ești Project Manager-ul NEXUS AI — un agent specializat în faza 1A: generarea Functional Architecture Sheet (FAS).

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
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Încearcă din nou în câteva secunde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credite insuficiente. Adaugă credite în Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Eroare AI gateway" }),
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
