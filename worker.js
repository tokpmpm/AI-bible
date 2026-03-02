/**
 * Cloudflare Worker Proxy for AI APIs
 * 
 * API 金鑰存放在 Worker 環境變數 (Secrets) 中，前端不需要傳送金鑰。
 * 
 * 環境變數設定：
 * 1. 登入 Cloudflare Dashboard -> Workers & Pages -> ai-bible-proxy
 * 2. Settings -> Variables -> Add Variable (記得點 Encrypt)
 * 3. 新增以下三個 Secret:
 *    - OPENAI_API_KEY
 *    - GEMINI_API_KEY
 *    - PERPLEXITY_API_KEY
 */

const ALLOWED_ORIGINS = [
  "https://tokpmpm.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";

    // 處理 CORS Preflight 請求
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("target");

    let apiUrl = "";
    let authHeaders = {};

    // 根據 target 參數決定轉發到哪個 API，並從環境變數取得對應的 API Key
    if (target === "openai") {
      if (!env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured in Worker" }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
        });
      }
      apiUrl = "https://api.openai.com/v1/chat/completions";
      authHeaders = { "Authorization": `Bearer ${env.OPENAI_API_KEY}` };

    } else if (target === "gemini") {
      if (!env.GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured in Worker" }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
        });
      }
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
      authHeaders = { "x-goog-api-key": env.GEMINI_API_KEY };

    } else if (target === "perplexity") {
      if (!env.PERPLEXITY_API_KEY) {
        return new Response(JSON.stringify({ error: "PERPLEXITY_API_KEY not configured in Worker" }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
        });
      }
      apiUrl = "https://api.perplexity.ai/chat/completions";
      authHeaders = { "Authorization": `Bearer ${env.PERPLEXITY_API_KEY}` };

    } else {
      return new Response("Invalid target parameter. Use ?target=openai, ?target=gemini, or ?target=perplexity", {
        status: 400, headers: corsHeaders(origin)
      });
    }

    try {
      const body = await request.text();

      // 發送請求到目標 API — Worker 自行帶上 API Key
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: body,
      });

      const responseBody = await response.text();

      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(origin),
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(origin),
        },
      });
    }
  },
};
