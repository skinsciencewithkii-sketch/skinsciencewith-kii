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

        if (url.searchParams.get("check") === "1") {
          if (!paymentId || !/^pay_[A-Za-z0-9]{6,64}$/.test(paymentId)) {
            return Response.json(
              { hasAccess: false },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }

          if (!(await purchaseExists(paymentId))) {
            return Response.json(
              { hasAccess: false },
              { status: 202, headers: { "cache-control": "no-store" } },
            );
          }

          return Response.json(
            { hasAccess: true },
            {
              headers: {
                "cache-control": "no-store",
                "Set-Cookie": accessCookieHeader(paymentId),
              },
            },
          );
        }

        if (paymentId) {
          for (let attempt = 0; attempt < 10; attempt++) {
            if (await purchaseExists(paymentId)) {
              return new Response(null, {
                status: 302,
                headers: {
                  Location: "/?welcome=1",
                  "Set-Cookie": accessCookieHeader(paymentId),
                },
              });
            }
            await new Promise((resolve) => setTimeout(resolve, 1_000));
          }
        }

        const pendingLocation = paymentId
          ? `/?pending=1&payment_id=${encodeURIComponent(paymentId)}`
          : "/?pending=1";
        return new Response(null, {
          status: 302,
          headers: { Location: pendingLocation, "cache-control": "no-store" },
        });
      },
    },
  },
});
