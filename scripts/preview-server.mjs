#!/usr/bin/env node
// Serves a production build (npm run build) locally for manual QA or the
// Playwright suite (see tests/e2e.spec.ts): static files from dist/ are
// served directly, everything else is routed through the built Netlify
// function so SSR pages and /api/* routes behave exactly as they will on
// Netlify. `vite preview` can't be used for this — it expects the
// tanstack-start default output layout, not the netlify preset's
// dist/ + .netlify/functions-internal/ split (see netlify.toml).
//
// Usage: node scripts/preview-server.mjs   (after `NITRO_PRESET=netlify npm run build`)
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const FUNCTION_ENTRY = join(ROOT, ".netlify/functions-internal/server/server.mjs");
const PORT = Number(process.env.PORT ?? 8888);
const HOST = process.env.HOST ?? "127.0.0.1";

// Sensible local-only fallbacks so the server can start without real
// secrets. Requests that actually need a working Supabase/Razorpay
// connection will fail the same way they would with real-but-wrong
// credentials — the point here is to exercise the app's own request
// handling and UI, not to stand in for a real backend.
process.env.GUIDE_ACCESS_SECRET ??= "local-preview-secret";
process.env.SUPABASE_URL ??= "http://localhost:0";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "local-preview-key";

if (!existsSync(DIST) || !existsSync(FUNCTION_ENTRY)) {
  console.error(
    "dist/ or the built Netlify function is missing. Run `NITRO_PRESET=netlify npm run build` first.",
  );
  process.exit(1);
}

const { default: handler } = await import(FUNCTION_ENTRY);

const MIME = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = req.url.split("?")[0];
    const filePath = join(DIST, urlPath);
    if (urlPath !== "/" && existsSync(filePath) && statSync(filePath).isFile()) {
      res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
      createReadStream(filePath).pipe(res);
      return;
    }

    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }
    const request = new Request(`http://${req.headers.host ?? HOST}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body,
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end("Internal error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Preview server listening on http://${HOST}:${PORT}`);
});
