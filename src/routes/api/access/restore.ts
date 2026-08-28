import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { accessCookieHeader, findPurchaseByIdentifier } from "@/lib/access.server";

const schema = z.object({ identifier: z.string().min(3).max(120) });

// Returning buyers: server checks the email/phone against verified purchases.
export const Route = createFileRoute("/api/access/restore")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ hasAccess: false }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) return Response.json({ hasAccess: false }, { status: 400 });

        const paymentId = await findPurchaseByIdentifier(parsed.data.identifier);
        if (!paymentId) return Response.json({ hasAccess: false }, { status: 200 });

        return Response.json(
          { hasAccess: true },
          { headers: { "Set-Cookie": accessCookieHeader(paymentId) } },
        );
      },
    },
  },
});
