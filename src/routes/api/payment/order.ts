import { createFileRoute } from "@tanstack/react-router";

import { EXPECTED_AMOUNT_PAISE } from "@/lib/access.server";
import { RazorpayConfigError, createOrder, publicKeyId } from "@/lib/razorpay.server";

// Creates the ₹399 order on the server. The browser never chooses the amount
// and never sees RAZORPAY_KEY_SECRET — only the publishable key id.
export const Route = createFileRoute("/api/payment/order")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const order = await createOrder();
          return Response.json(
            {
              orderId: order.id,
              amount: order.amount,
              currency: order.currency,
              keyId: publicKeyId(),
            },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (error) {
          if (error instanceof RazorpayConfigError) {
            console.error(`[payment] ${error.message}`);
            return Response.json(
              { error: "payment_unavailable" },
              { status: 503, headers: { "cache-control": "no-store" } },
            );
          }
          console.error(
            `[payment] could not create order for ${EXPECTED_AMOUNT_PAISE} paise:`,
            error instanceof Error ? error.message : "unknown error",
          );
          return Response.json(
            { error: "order_creation_failed" },
            { status: 502, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
