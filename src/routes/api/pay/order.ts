import { createFileRoute } from "@tanstack/react-router";

// Creates a ₹399 Razorpay order server-side. Only the public Key ID and the
// order id are returned; the Key Secret never leaves the server.
export const Route = createFileRoute("/api/pay/order")({
  server: {
    handlers: {
      POST: async () => {
        const { createGuideOrder, razorpayMode } = await import("@/lib/razorpay.server");
        try {
          const order = await createGuideOrder();
          console.log(
            "[razorpay] order created",
            JSON.stringify({ orderId: order.orderId, mode: razorpayMode(order.keyId) }),
          );
          return Response.json(order, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          const code = error instanceof Error ? error.message : "RAZORPAY_ORDER_FAILED";
          console.error("[razorpay] order creation failed", JSON.stringify({ code }));
          return Response.json(
            { error: code },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
