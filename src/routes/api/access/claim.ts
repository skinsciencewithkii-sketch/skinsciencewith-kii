import { createFileRoute } from "@tanstack/react-router";

import { accessCookieHeader, purchaseExists } from "@/lib/access.server";

// Razorpay redirects the buyer here after payment. The redirect itself is NOT
// proof of payment: access is granted only if the webhook already recorded a
// verified purchase for this payment id.
export const Route = createFileRoute("/api/access/claim")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const paymentId = url.searchParams.get("razorpay_payment_id");

        if (paymentId) {
          for (let attempt = 0; attempt < 4; attempt++) {
            if (await purchaseExists(paymentId)) {
              return new Response(null, {
                status: 302,
                headers: {
                  Location: "/?welcome=1",
                  "Set-Cookie": accessCookieHeader(paymentId),
                },
              });
            }
            await new Promise((resolve) => setTimeout(resolve, 900));
          }
        }

        return new Response(null, { status: 302, headers: { Location: "/?pending=1" } });
      },
    },
  },
});
