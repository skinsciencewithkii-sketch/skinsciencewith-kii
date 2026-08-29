// Server-only Razorpay helpers. Never import this from client code.
// RAZORPAY_KEY_SECRET is read here and never returned to the browser.
import { createHmac } from "crypto";

import { EXPECTED_AMOUNT_PAISE, safeEqual } from "@/lib/access.server";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export type RazorpayCredentials = { keyId: string; keySecret: string };

/** Reads the Razorpay credentials. Throws a safe error if they are missing. */
export function getRazorpayCredentials(): RazorpayCredentials {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) {
    console.error(
      "[razorpay] missing credentials",
      JSON.stringify({ hasKeyId: Boolean(keyId), hasKeySecret: Boolean(keySecret) }),
    );
    throw new Error("RAZORPAY_CREDENTIALS_MISSING");
  }
  return { keyId, keySecret };
}

/** true when the configured key is a live-mode key (used for logging only). */
export function razorpayMode(keyId: string): "live" | "test" | "unknown" {
  if (keyId.startsWith("rzp_live_")) return "live";
  if (keyId.startsWith("rzp_test_")) return "test";
  return "unknown";
}

async function razorpayFetch(
  path: string,
  credentials: RazorpayCredentials,
  init?: RequestInit,
): Promise<any> {
  const auth = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64");
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    // Razorpay error descriptions are safe to log; credentials are never included.
    console.error(
      "[razorpay] api error",
      JSON.stringify({
        path,
        status: response.status,
        code: body?.error?.code ?? null,
        description: body?.error?.description ?? null,
      }),
    );
    const error = new Error(
      response.status === 401 ? "RAZORPAY_AUTH_FAILED" : "RAZORPAY_API_ERROR",
    );
    throw error;
  }

  return body;
}

/** Creates a ₹399 order for the Acne Starter Guide. */
export async function createGuideOrder(): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}> {
  const credentials = getRazorpayCredentials();
  const order = await razorpayFetch("/orders", credentials, {
    method: "POST",
    body: JSON.stringify({
      amount: EXPECTED_AMOUNT_PAISE,
      currency: "INR",
      receipt: `guide_${Date.now()}`,
      notes: { product: "acne_starter_guide" },
    }),
  });

  if (!order?.id) {
    console.error("[razorpay] order response missing id");
    throw new Error("RAZORPAY_ORDER_FAILED");
  }

  return {
    orderId: String(order.id),
    amount: Number(order.amount),
    currency: String(order.currency ?? "INR"),
    keyId: credentials.keyId,
  };
}

/** Verifies the Checkout signature: HMAC-SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const { keySecret } = getRazorpayCredentials();
  const expected = createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(signature, expected);
}

export type VerifiedPayment = {
  paymentId: string;
  orderId: string;
  amount: number;
  email: string | null;
  contact: string | null;
};

/**
 * Confirms with Razorpay's API that the payment really exists, belongs to the
 * order, is captured, and is for the expected amount. The browser-supplied
 * values are never trusted on their own.
 */
export async function fetchVerifiedPayment(
  orderId: string,
  paymentId: string,
): Promise<VerifiedPayment | null> {
  const credentials = getRazorpayCredentials();
  const payment = await razorpayFetch(`/payments/${encodeURIComponent(paymentId)}`, credentials);

  const status = String(payment?.status ?? "");
  const amount = Number(payment?.amount ?? 0);

  if (String(payment?.order_id ?? "") !== orderId) {
    console.error("[razorpay] order mismatch", JSON.stringify({ paymentId }));
    return null;
  }
  if (status !== "captured") {
    console.error("[razorpay] payment not captured", JSON.stringify({ paymentId, status }));
    return null;
  }
  if (amount !== EXPECTED_AMOUNT_PAISE) {
    console.error("[razorpay] unexpected amount", JSON.stringify({ paymentId, amount }));
    return null;
  }

  return {
    paymentId,
    orderId,
    amount,
    email: payment?.email ? String(payment.email) : null,
    contact: payment?.contact ? String(payment.contact) : null,
  };
}

/** Records a verified purchase (idempotent) plus an access grant log entry. */
export async function recordVerifiedPurchase(
  payment: VerifiedPayment,
  source: string,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error } = await supabaseAdmin.from("purchases").upsert(
    {
      razorpay_payment_id: payment.paymentId,
      payment_link_id: payment.orderId,
      amount: payment.amount,
      email: payment.email,
      contact: payment.contact,
    },
    { onConflict: "razorpay_payment_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[razorpay] failed to record purchase", JSON.stringify({ message: error.message }));
    return false;
  }

  const grant = await supabaseAdmin
    .from("access_grants")
    .insert({ razorpay_payment_id: payment.paymentId, source });
  if (grant.error) {
    // Logging failure must not block a paid customer.
    console.error("[razorpay] failed to log grant", JSON.stringify({ message: grant.error.message }));
  }

  return true;
}
