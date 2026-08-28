import { createFileRoute } from "@tanstack/react-router";

import { purchaseExists, readAccessCookie } from "@/lib/access.server";

export const Route = createFileRoute("/api/access/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const paymentId = readAccessCookie(request);
        const hasAccess = paymentId ? await purchaseExists(paymentId) : false;
        return Response.json(
          { hasAccess },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
