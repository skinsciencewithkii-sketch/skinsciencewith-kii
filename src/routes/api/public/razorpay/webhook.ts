import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

import {
  EXPECTED_AMOUNT_PAISE,
  PAYMENT_LINK_ID,
  safeEqual,
} from "@/lib/access.server";

export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!webhookSecret) {
          console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }

        // Signature must be verified against the RAW body.
        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature");
        const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
        if (!signature || !safeEqual(signature, expected)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        if (payload?.event !== "payment_link.paid") {
          return new Response("Ignored", { status: 200 });
        }

        const link = payload?.payload?.payment_link?.entity;
        const payment = payload?.payload?.payment?.entity;

        if (!link || !payment) return new Response("Ignored", { status: 200 });
        if (link.id !== PAYMENT_LINK_ID) return new Response("Ignored", { status: 200 });
        if (payment.status !== "captured") return new Response("Ignored", { status: 200 });

        const amount = Number(payment.amount ?? link.amount_paid);
        if (amount !== EXPECTED_AMOUNT_PAISE) {
          return new Response("Ignored", { status: 200 });
        }

        const paymentId = String(payment.id ?? "");
        if (!paymentId) return new Response("Ignored", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Idempotent: razorpay_payment_id is unique, duplicates are no-ops.
        const { error } = await supabaseAdmin.from("purchases").upsert(
          {
            razorpay_payment_id: paymentId,
            payment_link_id: link.id,
            amount,
            email: payment.email ?? link.customer?.email ?? null,
            contact: payment.contact ? String(payment.contact) : (link.customer?.contact ?? null),
          },
          { onConflict: "razorpay_payment_id", ignoreDuplicates: true },
        );

        if (error) {
          console.error("Failed to record purchase", error.message);
          return new Response("Error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
