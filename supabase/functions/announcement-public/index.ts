// Public (unauthenticated) announcement viewer.
//
// Serves a minimal zh-TW HTML page with og: meta tags so when staff share
// a link to Facebook / LINE / their website, the recipient sees a nice
// branded preview card and can read the announcement without installing
// the app or logging in.
//
// URL: https://<project>.supabase.co/functions/v1/announcement-public?s=<slug>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function errorPage(message: string, status: number): Response {
  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EddyFlow</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif; background: #f5f5f7; margin: 0; padding: 40px 20px; color: #1c1c1e; }
  .card { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; padding: 40px 32px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  h1 { font-size: 18px; margin: 0 0 12px; color: #636366; font-weight: 600; }
  p { color: #8e8e93; margin: 0; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(message)}</h1>
    <p>EddyFlow</p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderAnnouncementPage(ann: {
  title: string;
  body: string;
  created_at: string;
  media_urls: unknown;
  organization_name: string;
}, slug: string, baseUrl: string): Response {
  const titleSafe = escapeHtml(ann.title);
  const bodySafe = escapeHtml(ann.body);
  const orgSafe = escapeHtml(ann.organization_name);

  // og:description — 1-2 sentences plain text, no HTML
  const ogDesc = truncate(ann.body.replace(/\s+/g, " ").trim(), 200);
  const ogDescSafe = escapeHtml(ogDesc);

  // og:image — first image from media_urls if any
  let ogImage: string | null = null;
  if (Array.isArray(ann.media_urls)) {
    const firstImage = ann.media_urls.find(
      (m: { type?: string; url?: string }) => m && m.type === "image" && typeof m.url === "string"
    );
    if (firstImage && typeof firstImage.url === "string") {
      ogImage = firstImage.url;
    }
  }

  const pageUrl = `${baseUrl}?s=${encodeURIComponent(slug)}`;
  const date = new Date(ann.created_at).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const ogImageTag = ogImage
    ? `<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">`
    : "";

  // Render media inline (images only for simplicity; docs are just links)
  let mediaHtml = "";
  if (Array.isArray(ann.media_urls)) {
    for (const m of ann.media_urls as { type?: string; url?: string; file_name?: string }[]) {
      if (!m || !m.url) continue;
      if (m.type === "image") {
        mediaHtml += `<img src="${escapeHtml(m.url)}" alt="" class="media">`;
      } else {
        const label = escapeHtml(m.file_name ?? "附件");
        mediaHtml += `<a class="attachment" href="${escapeHtml(m.url)}" target="_blank" rel="noopener">📎 ${label}</a>`;
      }
    }
  }

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titleSafe} · ${orgSafe}</title>

<meta property="og:type" content="article">
<meta property="og:title" content="${titleSafe}">
<meta property="og:description" content="${ogDescSafe}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:site_name" content="${orgSafe}">
<meta property="og:locale" content="zh_TW">
${ogImageTag}

<meta name="twitter:card" content="summary${ogImage ? "_large_image" : ""}">
<meta name="twitter:title" content="${titleSafe}">
<meta name="twitter:description" content="${ogDescSafe}">

<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif;
    background: #f5f5f7;
    margin: 0; padding: 0;
    color: #1c1c1e;
    line-height: 1.6;
  }
  .header {
    background: white;
    padding: 24px 20px;
    text-align: center;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .header .org { font-size: 14px; color: #636366; font-weight: 500; letter-spacing: 0.02em; }
  .header .brand { font-size: 11px; color: #aeaeb2; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.1em; }
  .container { max-width: 640px; margin: 0 auto; padding: 24px 20px 48px; }
  .card {
    background: white;
    border-radius: 16px;
    padding: 28px 24px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  }
  h1 { font-size: 22px; margin: 0 0 8px; color: #1c1c1e; line-height: 1.3; }
  .date { font-size: 13px; color: #8e8e93; margin-bottom: 20px; }
  .body { font-size: 16px; color: #1c1c1e; white-space: pre-wrap; }
  .media { display: block; width: 100%; border-radius: 12px; margin-top: 16px; }
  .attachment { display: block; padding: 12px; margin-top: 10px; background: #f5f5f7; border-radius: 10px; text-decoration: none; color: #007aff; font-size: 14px; }
  .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #aeaeb2; }
  @media (prefers-color-scheme: dark) {
    body { background: #000; color: #f2f2f7; }
    .header { background: #1c1c1e; border-bottom-color: rgba(255,255,255,0.08); }
    .card { background: #1c1c1e; box-shadow: none; }
    h1, .body { color: #f2f2f7; }
    .header .org { color: #aeaeb2; }
    .date, .footer, .header .brand { color: #636366; }
    .attachment { background: #2c2c2e; color: #0a84ff; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="org">${orgSafe}</div>
    <div class="brand">EddyFlow</div>
  </div>
  <div class="container">
    <div class="card">
      <h1>${titleSafe}</h1>
      <div class="date">${escapeHtml(date)}</div>
      <div class="body">${bodySafe}</div>
      ${mediaHtml}
    </div>
    <div class="footer">由 ${orgSafe} 發佈</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return errorPage("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("s");

  if (!slug || !/^[a-z0-9]{4,32}$/.test(slug)) {
    return errorPage("找不到公告 · Announcement not found", 404);
  }

  const { data, error } = await supabase.rpc("get_public_announcement", {
    p_slug: slug,
  });

  if (error) {
    console.error("[announcement-public] rpc error:", error.message);
    return errorPage("發生錯誤 · Something went wrong", 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return errorPage("找不到公告 · Announcement not found", 404);
  }

  const baseUrl = `${url.origin}${url.pathname}`;
  return renderAnnouncementPage(row, slug, baseUrl);
});
