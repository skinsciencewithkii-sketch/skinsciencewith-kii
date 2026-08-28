import { createFileRoute } from "@tanstack/react-router";

import { purchaseExists, readAccessCookie } from "@/lib/access.server";

// The paid guide markup is only ever sent to a browser holding a signed
// access cookie backed by a webhook-verified purchase.
export const Route = createFileRoute("/api/access/guide")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const paymentId = readAccessCookie(request);
        if (!paymentId || !(await purchaseExists(paymentId))) {
          return new Response("Not available", { status: 403 });
        }
        const { getPaidGuideHtml } = await import("@/lib/guide-content.server");
        return new Response(getPaidGuideHtml(), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
