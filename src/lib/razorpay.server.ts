// Server-only Razorpay helpers. Never import from client code.
// RAZORPAY_KEY_SECRET is read inside functions (per-request env injection) and
// is never returned to the browser.
import { createHmac } from "crypto";

import { EXPECTED_AMOUNT_PAISE, safeEqual } from "./access.server";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export class RazorpayConfigError extends Error {}

function credentials(): { keyId: string; keySecret: string } {
  // Read at call time (per-request env injection) and trim stray whitespace,
  // which would otherwise silently break Basic authentication.
  const keyId = process.env["RAZORPAY_KEY_ID"]?.trim();
  const keySecret = process.env["RAZORPAY_KEY_SECRET"]?.trim();
  if (!keyId || !keySecret) {
    throw new RazorpayConfigError(
      "Razorpay is not configured: RAZORPAY_KEY_ID and/or RAZORPAY_KEY_SECRET are missing",
    );
  }
  return { keyId, keySecret };
}


/** Public key id, safe to send to the browser (never the secret). */
export function publicKeyId(): string {
  return credentials().keyId;
}

/** "test" or "live", derived from the key id prefix so both stay consistent. */
export function razorpayMode(): "test" | "live" {
  return credentials().keyId.startsWith("rzp_live") ? "live" : "test";
}

function authHeader(): string {
  const { keyId, keySecret } = credentials();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function razorpayRequest(
  path: string,
  init: RequestInit & { method: string },
): Promise<{ ok: boolean; status: number; body: any }> {
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
  });

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { ok: response.ok, status: response.status, body };
}

export type RazorpayOrder = { id: string; amount: number; currency: string };

/** Creates a ₹399 order server-side. Amount is never taken from the client. */
export async function createOrder(): Promise<RazorpayOrder> {
  const receipt = `acne_guide_${Date.now()}`;
  const { ok, status, body } = await razorpayRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: EXPECTED_AMOUNT_PAISE,
      currency: "INR",
      receipt,
      notes: { product: "acne_starter_guide" },
    }),
  });

  if (!ok || !body?.id) {
    // Log the reason (Razorpay's own error description) without any secret.
    console.error(
      `[razorpay] order creation failed status=${status} code=${
        body?.error?.code ?? "unknown"
      } description=${body?.error?.description ?? "none"}`,
    );
    if (status === 401 || status === 403) {
      const { keyId, keySecret } = credentials();
      // Shape-only diagnostics: never the values themselves.
      console.error(
        `[razorpay] credentials rejected by Razorpay (keyId prefix=${keyId.slice(
          0,
          8,
        )}, keyId length=${keyId.length}, keySecret length=${keySecret.length}; a Razorpay Key Secret is normally ~24 characters)`,
      );
      throw new RazorpayConfigError("Razorpay rejected RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET");
    }
    throw new Error("order_creation_failed");
  }


  return { id: body.id, amount: body.amount, currency: body.currency };
}

/** HMAC check of `order_id|payment_id` using the key secret. */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const { keySecret } = credentials();
  const expected = createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(signature, expected);
}

export type RazorpayPayment = {
  id: string;
  status: string;
  amount: number;
  order_id: string;
  email: string | null;
  contact: string | null;
};

/** Second, authoritative check: ask Razorpay about the payment itself. */
export async function fetchPayment(paymentId: string): Promise<RazorpayPayment | null> {
  const { ok, status, body } = await razorpayRequest(
    `/payments/${encodeURIComponent(paymentId)}`,
    { method: "GET" },
  );

  if (!ok || !body?.id) {
    console.error(
      `[razorpay] payment fetch failed status=${status} code=${
        body?.error?.code ?? "unknown"
      } description=${body?.error?.description ?? "none"}`,
    );
    return null;
  }

  return {
    id: body.id,
    status: String(body.status ?? ""),
    amount: Number(body.amount ?? 0),
    order_id: String(body.order_id ?? ""),
    email: body.email ?? null,
    contact: body.contact ? String(body.contact) : null,
  };
}
