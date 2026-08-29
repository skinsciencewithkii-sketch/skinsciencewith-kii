import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EXPECTED_AMOUNT_PAISE, accessCookieHeader } from "@/lib/access.server";
import {
  RazorpayConfigError,
  fetchPayment,
  verifyCheckoutSignature,
} from "@/lib/razorpay.server";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(6).max(64).regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().min(6).max(64).regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().min(32).max(256).regex(/^[a-f0-9]+$/),
});

function failure(reason: string, status = 400) {
  return Response.json(
    { verified: false, error: reason },
    { status, headers: { "cache-control": "no-store" } },
  );
}

// Server-side verification of a Razorpay Checkout success payload.
// Access is granted only when the signature AND Razorpay's own record of the
// payment both check out.
export const Route = createFileRoute("/api/payment/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          console.error("[payment] verification rejected: malformed checkout payload");
          return failure("invalid_payload");
        }

        const {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        } = parsed;

        try {
          if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
            console.error(
              `[payment] signature mismatch for order=${orderId} payment=${paymentId}`,
            );
            return failure("signature_mismatch", 401);
          }

          const payment = await fetchPayment(paymentId);
          if (!payment) {
            return failure("payment_lookup_failed", 502);
          }
          if (payment.order_id !== orderId) {
            console.error(
              `[payment] order mismatch: payment=${paymentId} belongs to ${payment.order_id}, expected ${orderId}`,
            );
            return failure("order_mismatch", 401);
          }
          if (payment.status !== "captured" && payment.status !== "authorized") {
            console.error(
              `[payment] payment=${paymentId} not captured (status=${payment.status})`,
            );
            return failure("payment_not_captured", 402);
          }
          if (payment.amount !== EXPECTED_AMOUNT_PAISE) {
            console.error(
              `[payment] amount mismatch for payment=${paymentId}: got ${payment.amount} paise`,
            );
            return failure("amount_mismatch", 402);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("purchases").upsert(
            {
              razorpay_payment_id: payment.id,
              payment_link_id: payment.order_id,
              amount: payment.amount,
              email: payment.email,
              contact: payment.contact,
            },
            { onConflict: "razorpay_payment_id", ignoreDuplicates: true },
          );
          if (error) {
            console.error(`[payment] could not record purchase ${payment.id}: ${error.message}`);
            return failure("record_failed", 500);
          }

          await supabaseAdmin
            .from("access_grants")
            .insert({ razorpay_payment_id: payment.id, source: "checkout_verification" });

          return Response.json(
            { verified: true, redirectTo: "/guide" },
            {
              headers: {
                "cache-control": "no-store",
                "Set-Cookie": accessCookieHeader(payment.id),
              },
            },
          );
        } catch (error) {
          if (error instanceof RazorpayConfigError) {
            console.error(`[payment] ${error.message}`);
            return failure("payment_unavailable", 503);
          }
          console.error(
            `[payment] verification error for order=${orderId}:`,
            error instanceof Error ? error.message : "unknown error",
          );
          return failure("verification_failed", 500);
        }
      },
    },
  },
});
