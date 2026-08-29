import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

import { PAYMENT_LINK_ID } from "@/lib/access.server";
import { updatePaymentLinkCallback } from "@/lib/razorpay.server";

const CALLBACK_URL = "https://skinsciencewithkii.netlify.app/api/access/claim";

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
      POST: async ({ request }) => {
        const secret = process.env["GUIDE_ACCESS_SECRET"]?.trim();
        const provided = request.headers.get("x-setup-secret")?.trim() ?? "";
        if (
          !secret ||
          provided.length !== secret.length ||
          !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
        ) {
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
