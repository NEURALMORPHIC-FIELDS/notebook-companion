/**
 * deploy-trigger/index.ts — Supabase Edge Function (Deno)
 * NEXUS AI v6 — Sprint E: Deploy Trigger
 *
 * Calls a Netlify or Vercel deploy hook URL to trigger a deployment.
 * The hook URL is passed in from the browser (stored in user's localStorage).
 *
 * Request: { provider: 'netlify'|'vercel', hook_url: string }
 * Response: { triggered: true, provider, timestamp }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TriggerRequest {
    provider: "netlify" | "vercel";
    hook_url: string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    let body: TriggerRequest;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    const { provider, hook_url } = body;

    if (!provider || !hook_url) {
        return new Response(JSON.stringify({ error: "Missing required fields: provider, hook_url" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    if (!hook_url.startsWith("https://")) {
        return new Response(JSON.stringify({ error: "hook_url must be https://" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    try {
        // Both Netlify and Vercel accept a POST to the hook URL to trigger a deploy
        const deployResp = await fetch(hook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trigger: "nexus-ai", provider }),
        });

        if (!deployResp.ok) {
            const errText = await deployResp.text().catch(() => "");
            return new Response(JSON.stringify({
                error: `Deploy hook returned ${deployResp.status}: ${errText}`,
            }), {
                status: deployResp.status,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({
            triggered: true,
            provider,
            timestamp: new Date().toISOString(),
        }), {
            status: 200,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[deploy-trigger] Error:", err);
        return new Response(JSON.stringify({
            error: err instanceof Error ? err.message : "Deploy trigger failed",
        }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }
});
