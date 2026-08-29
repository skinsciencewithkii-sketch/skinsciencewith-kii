import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import coverTop from "../../content/cover-top.html?raw";
import coverBottom from "../../content/cover-bottom.html?raw";

const COVER_HTML = `${coverTop}<div id="kii-pay-slot"></div>${coverBottom}`;

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

// The existing, working ₹399 Razorpay Payment Link. Used as-is whenever
// Checkout can't be started, so buyers always have a working payment path.
const PAYMENT_LINK_URL = "https://rzp.io/rzp/DnSVNzC";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Acne Starter Guide — Skin Science with Kii" },
      {
        name: "description",
        content:
          "A simple, evidence-informed acne guide by Dr. Kii — understand your skin without falling into the skincare rabbit hole.",
      },
      { property: "og:title", content: "The Acne Starter Guide — Skin Science with Kii" },
      {
        property: "og:description",
        content: "Understand it. Simplify it. Treat it better. The Acne Starter Guide by Dr. Kii.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: "/guide.css" }],
  }),
  component: GuidePage,
});

function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    if (!existing) {
      script.src = CHECKOUT_SCRIPT;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

function GuidePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "locked" | "unlocked">("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async (autoOpen = false) => {
      try {
        const response = await fetch("/api/access/status", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = (await response.json()) as { hasAccess: boolean };
        if (cancelled) return;
        setState(data.hasAccess ? "unlocked" : "locked");
        if (data.hasAccess && autoOpen) void navigate({ to: "/guide" });
      } catch {
        if (!cancelled) setState("locked");
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get("locked") === "1") {
      setError("That guide link is locked. Complete your ₹399 purchase to open it.");
    }

    // Returning from the Razorpay Payment Link: the redirect alone proves
    // nothing, so poll the server until the verified webhook has landed.
    const pendingPaymentId = params.get("payment_id");
    if (params.get("pending") === "1" && pendingPaymentId) {
      setError("Confirming your payment with Razorpay… this can take a few seconds.");
      void (async () => {
        for (let attempt = 0; attempt < 45 && !cancelled; attempt++) {
          try {
            const response = await fetch(
              `/api/access/claim?check=1&razorpay_payment_id=${encodeURIComponent(pendingPaymentId)}`,
              { credentials: "same-origin", cache: "no-store" },
            );
            const data = (await response.json()) as { hasAccess?: boolean };
            if (data.hasAccess) {
              if (!cancelled) {
                setState("unlocked");
                setError(null);
                void navigate({ to: "/guide" });
              }
              return;
            }
          } catch {
            /* keep polling */
          }
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
        if (!cancelled) {
          setError(
            "We haven't received confirmation for that payment yet. Refresh in a minute, or contact us and we'll open your guide.",
          );
        }
      })();
    }

    void check();
    void loadCheckoutScript();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // The cover markup is injected as HTML, so move the React-rendered payment
  // card into its slot inside that markup.
  useEffect(() => {
    const place = () => {
      const slot = coverRef.current?.querySelector<HTMLElement>("#kii-pay-slot");
      const node = cardRef.current;
      if (slot && node && node.parentElement !== slot) slot.appendChild(node);
    };
    place();
    const timer = window.setInterval(place, 500);
    return () => window.clearInterval(timer);
  }, []);

  async function startCheckout() {
    setError(null);
    setBusy(true);

    try {
      const ready = await loadCheckoutScript();
      if (!ready || !window.Razorpay) {
        setError("Payment window couldn't load. Check your connection and try again.");
        setBusy(false);
        return;
      }

      const orderResponse = await fetch("/api/payment/order", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!orderResponse.ok) {
        // Fall back to the existing, working Payment Link. Access is still
        // granted only after the verified payment_link.paid webhook.
        window.location.href = PAYMENT_LINK_URL;
        return;
      }

      const order = (await orderResponse.json()) as {
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
      };

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Skin Science with Kii",
        description: "The Acne Starter Guide",
        theme: { color: "#3e342d" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setError("Payment was cancelled. You can try again whenever you're ready.");
          },
        },
        handler: async (response: Record<string, string>) => {
          try {
            const verifyResponse = await fetch("/api/payment/verify", {
              method: "POST",
              credentials: "same-origin",
              cache: "no-store",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response["razorpay_order_id"],
                razorpay_payment_id: response["razorpay_payment_id"],
                razorpay_signature: response["razorpay_signature"],
              }),
            });
            const result = (await verifyResponse.json()) as { verified?: boolean };
            if (!verifyResponse.ok || !result.verified) {
              setBusy(false);
              setError(
                "We couldn't confirm that payment yet. If money left your account, tap the button again or contact us and we'll open your guide.",
              );
              return;
            }
            setState("unlocked");
            void navigate({ to: "/guide" });
          } catch {
            setBusy(false);
            setError("We couldn't confirm that payment. Please try again.");
          }
        },
      });

      checkout.open();
    } catch {
      setBusy(false);
      setError("Something went wrong starting the payment. Please try again.");
    }
  }

  const card =
    state === "unlocked" ? (
      <div className="payment-gate">
        <div className="pay-kicker">skin science with kii</div>
        <p className="pay-title">You're in. Let's understand your acne.</p>
        <p className="pay-copy">Your full guide is ready to read.</p>
        <button className="pay-btn" type="button" onClick={() => void navigate({ to: "/guide" })}>
          Open my guide
        </button>
      </div>
    ) : (
      <PaymentCard
        checking={state === "checking"}
        busy={busy}
        error={error}
        onBuy={() => void startCheckout()}
      />
    );

  return (
    <>
      <div ref={coverRef} dangerouslySetInnerHTML={{ __html: COVER_HTML }} />
      <div ref={cardRef} style={{ display: "contents" }}>
        {card}
      </div>
    </>
  );
}

function PaymentCard({
  checking,
  busy,
  error,
  onBuy,
}: {
  checking: boolean;
  busy: boolean;
  error: string | null;
  onBuy: () => void;
}) {
  return (
    <div className="payment-gate">
      <div className="pay-kicker">skin science with kii</div>
      <p className="pay-title">Your full acne guide is waiting.</p>
      <p className="pay-copy">Unlock the complete Skin Science with Kii Acne Starter Guide.</p>
      <p className="price">₹399 • One-time payment</p>
      <button className="pay-btn" type="button" onClick={onBuy} disabled={busy || checking}>
        {busy ? "Opening payment…" : "Buy the Acne Guide — ₹399"}
      </button>

      {error ? <p className="fine-print">{error}</p> : null}
      {checking ? <p className="fine-print">One moment…</p> : null}
    </div>
  );
}
