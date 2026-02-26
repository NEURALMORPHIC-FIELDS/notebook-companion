/**
 * file-writer/index.ts — Supabase Edge Function (Deno)
 * NEXUS AI v6 — Sprint B: GitHub File Writer
 *
 * Writes or updates a file in a GitHub repository using the
 * GitHub REST API (PUT /repos/{owner}/{repo}/contents/{path}).
 *
 * Request body:
 *   { owner, repo, path, content, message, token, branch? }
 *
 * Response:
 *   { sha, html_url, committed: true }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WriteRequest {
    owner: string;
    repo: string;
    path: string;          // e.g. "src/components/Foo.tsx"
    content: string;       // raw UTF-8 content (will be base64-encoded)
    message: string;       // commit message
    token: string;         // GitHub Personal Access Token
    branch?: string;       // defaults to "main"
}

interface GitHubContentsResponse {
    content: {
        sha: string;
        html_url: string;
    };
}

interface WriteResponse {
    committed: true;
    sha: string;
    html_url: string;
    path: string;
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

    let body: WriteRequest;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    const { owner, repo, path, content, message, token, branch = "main" } = body;

    if (!owner || !repo || !path || !content || !message || !token) {
        return new Response(JSON.stringify({ error: "Missing required fields: owner, repo, path, content, message, token" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // Check if file already exists (need SHA for update)
    let existingSha: string | undefined;
    try {
        const checkResp = await fetch(`${apiUrl}?ref=${branch}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });
        if (checkResp.ok) {
            const existing = await checkResp.json();
            existingSha = existing.sha;
        }
    } catch {
        // File doesn't exist — that's fine, we'll create it
    }

    // base64-encode the content
    const encoded = btoa(unescape(encodeURIComponent(content)));

    const payload: Record<string, string> = {
        message,
        content: encoded,
        branch,
    };
    if (existingSha) {
        payload.sha = existingSha;
    }

    try {
        const writeResp = await fetch(apiUrl, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!writeResp.ok) {
            const errText = await writeResp.text();
            return new Response(JSON.stringify({ error: `GitHub API error ${writeResp.status}: ${errText}` }), {
                status: writeResp.status,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
        }

        const data: GitHubContentsResponse = await writeResp.json();

        const result: WriteResponse = {
            committed: true,
            sha: data.content.sha,
            html_url: data.content.html_url,
            path,
        };

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[file-writer] Error:", err);
        return new Response(JSON.stringify({
            error: err instanceof Error ? err.message : "Write failed",
        }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }
});
