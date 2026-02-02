/**
 * Cloudflare Worker Proxy for AI APIs
 * 
 * 部署說明：
 * 1. 登入 Cloudflare Dashboard -> Workers & Pages -> Create Application -> Create Worker
 * 2. 命名您的 Worker (例如: ai-bible-proxy)
 * 3. 點擊 "Deploy"
 * 4. 點擊 "Edit code"
 * 5. 將此檔案的全部內容複製貼上，覆蓋原有的 worker.js
 * 6. 點擊 "Deploy"
 * 7. 記下您的 Worker URL (例如: https://ai-bible-proxy.您的帳號.workers.dev)
 */

export default {
  async fetch(request, env, ctx) {
    // 處理 CORS Preflight 請求 (瀏覽器會先發送 OPTIONS 請求來確認權限)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*", // 允許所有來源，或修改為您的 GitHub Pages 網址
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-goog-api-key, Authorization",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("target");

    let apiUrl = "";
    
    // 根據 target 參數決定轉發到哪個 API
    if (target === "openai") {
      apiUrl = "https://api.openai.com/v1/chat/completions";
    } else if (target === "gemini") {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
    } else if (target === "perplexity") {
      apiUrl = "https://api.perplexity.ai/chat/completions";
    } else {
      return new Response("Invalid target parameter. Use ?target=openai, ?target=gemini, or ?target=perplexity", { status: 400 });
    }

    try {
      // 複製原始請求的內容
      const body = await request.text();
      const headers = new Headers(request.headers);
      
      // 確保 Host header 是正確的目標 API，而不是 Worker 本身
      headers.delete("Host");

      // 發送請求到目標 API
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: headers,
        body: body,
      });

      // 取得回應並加上 CORS header 回傳給前端
      const responseBody = await response.text();
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");

      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        },
      });
    }
  },
};
