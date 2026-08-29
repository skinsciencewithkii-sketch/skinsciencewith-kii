import { createFileRoute } from "@tanstack/react-router";

import {
  EXPECTED_AMOUNT_PAISE,
  accessCookieHeader,
  purchaseExists,
} from "@/lib/access.server";
import { fetchPayment, verifyPaymentLinkSignature } from "@/lib/razorpay.server";

const PAYMENT_ID = /^pay_[A-Za-z0-9]{6,64}$/;

/**
 * Fallback verification when the webhook has not landed yet: the callback
 * signature is checked with the key secret AND the payment is re-read from
 * Razorpay before anything is recorded. Never trusts the redirect alone.
 */
async function verifyViaCallback(url: URL, paymentId: string): Promise<boolean> {
  const linkId = url.searchParams.get("razorpay_payment_link_id");
  const status = url.searchParams.get("razorpay_payment_link_status");
  const signature = url.searchParams.get("razorpay_signature");
  const referenceId = url.searchParams.get("razorpay_payment_link_reference_id") ?? "";
  if (!linkId || !status || !signature) return false;

  try {
    if (
      !verifyPaymentLinkSignature({
        paymentLinkId: linkId,
        referenceId,
        status,
        paymentId,
        signature,
      })
    ) {
      console.error(`[access] payment link callback signature mismatch for ${paymentId}`);
      return false;
    }

    const payment = await fetchPayment(paymentId);
    if (!payment) return false;
    if (payment.status !== "captured" && payment.status !== "authorized") return false;
    if (payment.amount !== EXPECTED_AMOUNT_PAISE) return false;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("purchases").upsert(
      {
        razorpay_payment_id: payment.id,
        payment_link_id: linkId,
        amount: payment.amount,
        email: payment.email,
        contact: payment.contact,
      },
      { onConflict: "razorpay_payment_id", ignoreDuplicates: true },
    );
    if (error) {
      console.error(`[access] could not record purchase ${payment.id}: ${error.message}`);
      return false;
    }

    await supabaseAdmin
      .from("access_grants")
      .insert({ razorpay_payment_id: payment.id, source: "payment_link_callback" });

    return true;
  } catch (error) {
    console.error(
      "[access] callback verification failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return false;
  }
}

// Razorpay redirects the buyer here after payment. The redirect itself is NOT
// proof of payment: access is granted only after the webhook recorded a
// verified purchase, or after the signed callback is confirmed with Razorpay.
export const Route = createFileRoute("/api/access/claim")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const paymentId = url.searchParams.get("razorpay_payment_id");
        const isCheck = url.searchParams.get("check") === "1";

        if (!paymentId || !PAYMENT_ID.test(paymentId)) {
          if (isCheck) {
            return Response.json(
              { hasAccess: false },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }
          return new Response(null, {
            status: 302,
            headers: { Location: "/?pending=1", "cache-control": "no-store" },
          });
        }

        const verified =
          (await purchaseExists(paymentId)) || (await verifyViaCallback(url, paymentId));

        if (isCheck) {
          if (!verified) {
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

        if (verified) {
          // Straight into the paid guide with the signed access cookie set.
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/guide",
              "cache-control": "no-store",
              "Set-Cookie": accessCookieHeader(paymentId),
            },
          });
        }

        // Webhook still in flight: wait briefly, then hand off to the poller.
        for (let attempt = 0; attempt < 8; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          if (await purchaseExists(paymentId)) {
            return new Response(null, {
              status: 302,
              headers: {
                Location: "/guide",
                "cache-control": "no-store",
                "Set-Cookie": accessCookieHeader(paymentId),
              },
            });
          }
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: `/?pending=1&payment_id=${encodeURIComponent(paymentId)}`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
