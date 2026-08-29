import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

import { PAYMENT_LINK_ID } from "@/lib/access.server";
import { fetchPaymentLink, updatePaymentLinkCallback } from "@/lib/razorpay.server";

const CALLBACK_URL = "https://skinsciencewithkii.netlify.app/api/access/claim";

function isAuthorized(request: Request): boolean {
  const secret = process.env["GUIDE_ACCESS_SECRET"]?.trim();
  const provided = request.headers.get("x-setup-secret")?.trim() ?? "";
  return Boolean(
    secret &&
      provided.length === secret.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(secret)),
  );
}

/**
 * One-off maintenance endpoint: points the EXISTING Razorpay Payment Link at
 * the /api/access/claim callback (GET). Creates no new link or flow.
 *
 * Protected by the server-only GUIDE_ACCESS_SECRET passed in the
 * `x-setup-secret` header, so it cannot be triggered by visitors.
 */
export const Route = createFileRoute("/api/access/configure-link")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const link = await fetchPaymentLink(PAYMENT_LINK_ID);
          if (!link) {
            return Response.json({ found: false }, { status: 502 });
          }
          return Response.json({
            found: true,
            id: link.id,
            short_url: link.short_url,
            status: link.status,
            amountPaise: link.amount,
            callback_url: link.callback_url,
            callback_method: link.callback_method,
          });
        } catch (error) {
          console.error(
            "[access] configure-link read failed:",
            error instanceof Error ? error.message : "unknown error",
          );
          return Response.json({ found: false, detail: "config_error" }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const result = await updatePaymentLinkCallback(PAYMENT_LINK_ID, CALLBACK_URL);
          return Response.json(
            { updated: result.ok, paymentLinkId: PAYMENT_LINK_ID, detail: result.description },
            { status: result.ok ? 200 : 502 },
          );
        } catch (error) {
          console.error(
            "[access] configure-link failed:",
            error instanceof Error ? error.message : "unknown error",
          );
          return Response.json({ updated: false, detail: "config_error" }, { status: 500 });
        }
      },
    },
  },
});
