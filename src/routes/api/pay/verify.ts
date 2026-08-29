import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { accessCookieHeader } from "@/lib/access.server";

const payloadSchema = z.object({
  razorpay_order_id: z.string().min(6).max(64),
  razorpay_payment_id: z.string().min(6).max(64),
  razorpay_signature: z.string().min(16).max(256),
});

// Verifies a completed Checkout payment. Access is granted only when the
// signature is valid AND Razorpay's own API confirms a captured ₹399 payment.
export const Route = createFileRoute("/api/pay/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fail = (code: string, status = 400) => {
          console.error("[razorpay] verification failed", JSON.stringify({ code }));
          return Response.json(
            { ok: false, error: code },
            { status, headers: { "cache-control": "no-store" } },
          );
        };

        let parsed: z.infer<typeof payloadSchema>;
        try {
          parsed = payloadSchema.parse(await request.json());
        } catch {
          return fail("INVALID_PAYLOAD");
        }

        const { fetchVerifiedPayment, recordVerifiedPurchase, verifyCheckoutSignature } =
          await import("@/lib/razorpay.server");

        try {
          if (
            !verifyCheckoutSignature(
              parsed.razorpay_order_id,
              parsed.razorpay_payment_id,
              parsed.razorpay_signature,
            )
          ) {
            return fail("SIGNATURE_MISMATCH", 401);
          }

          const payment = await fetchVerifiedPayment(
            parsed.razorpay_order_id,
            parsed.razorpay_payment_id,
          );
          if (!payment) return fail("PAYMENT_NOT_CONFIRMED", 402);

          if (!(await recordVerifiedPurchase(payment, "checkout"))) {
            return fail("PURCHASE_RECORD_FAILED", 500);
          }

          console.log(
            "[razorpay] payment verified",
            JSON.stringify({ paymentId: payment.paymentId }),
          );

          return Response.json(
            { ok: true, redirect: "/guide" },
            {
              headers: {
                "cache-control": "no-store",
                "Set-Cookie": accessCookieHeader(payment.paymentId),
              },
            },
          );
        } catch (error) {
          const code = error instanceof Error ? error.message : "VERIFICATION_ERROR";
          return fail(code, 500);
        }
      },
    },
  },
});
