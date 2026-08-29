// Server-only helpers for verified-purchase access.
// Never import this from client code.
import { createHmac, timingSafeEqual } from "crypto";

export const ACCESS_COOKIE = "kii_guide_access";

export const EXPECTED_AMOUNT_PAISE = 39900;

/** The existing ₹399 Razorpay Payment Link (unchanged). */
export const PAYMENT_LINK_ID = "plink_TVWpTNZeQCrjHU";

function secret(): string {
  const value = process.env["GUIDE_ACCESS_SECRET"];
  if (!value) throw new Error("GUIDE_ACCESS_SECRET is not configured");
  return value;
}

function hmac(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Creates the signed cookie value for a verified purchase. */
export function createAccessToken(paymentId: string): string {
  return `${paymentId}.${hmac(paymentId, secret())}`;
}

/** Returns the payment id if the cookie is present and correctly signed. */
export function readAccessCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const raw = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_COOKIE}=`));
  if (!raw) return null;
  const value = decodeURIComponent(raw.slice(ACCESS_COOKIE.length + 1));
  const index = value.lastIndexOf(".");
  if (index <= 0) return null;
  const paymentId = value.slice(0, index);
  const signature = value.slice(index + 1);
  if (!safeEqual(signature, hmac(paymentId, secret()))) return null;
  return paymentId;
}

export function accessCookieHeader(paymentId: string): string {
  const oneYear = 60 * 60 * 24 * 365;
  return `${ACCESS_COOKIE}=${encodeURIComponent(
    createAccessToken(paymentId),
  )}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${oneYear}`;
}

/** Confirms the payment id was recorded by the verified Razorpay webhook. */
export async function purchaseExists(paymentId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("purchases")
    .select("id")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();
  return Boolean(data);
}

