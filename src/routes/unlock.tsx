import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import coverTop from "../../content/cover-top.html?raw";
import coverBottom from "../../content/cover-bottom.html?raw";

const COVER_HTML = `${coverTop}<div id="kii-pay-slot"></div>${coverBottom}`;

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on?: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SCRIPT_FAILED")));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("SCRIPT_FAILED"));
    document.body.appendChild(script);
  });
}

export const Route = createFileRoute("/unlock")({
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
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,500&family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: "/guide.css" },
    ],
  }),
  component: CoverPage,
});

function CoverPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "locked" | "unlocked">("checking");
  const coverRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch("/api/access/status", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = (await response.json()) as { hasAccess: boolean };
        if (cancelled) return;
        setState(data.hasAccess ? "unlocked" : "locked");
      } catch {
        if (!cancelled) setState("locked");
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const card =
    state === "unlocked" ? (
      <div className="payment-gate">
        <div className="pay-kicker">skin science with kii</div>
        <p className="pay-title">You're in. Let's understand your acne.</p>
        <p className="pay-copy">Your full guide is ready.</p>
        <button className="pay-btn" type="button" onClick={() => void navigate({ to: "/guide" })}>
          Read my guide
        </button>
      </div>
    ) : (
      <PaymentCard
        checking={state === "checking"}
        onUnlocked={() => void navigate({ to: "/guide" })}
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

function PaymentCard({ checking, onUnlocked }: { checking: boolean; onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startPayment() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      await loadCheckoutScript();

      const orderResponse = await fetch("/api/pay/order", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!orderResponse.ok) throw new Error("ORDER_FAILED");
      const order = (await orderResponse.json()) as {
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
      };

      const Checkout = window.Razorpay;
      if (!Checkout) throw new Error("SCRIPT_FAILED");

      // Distinguishes an actual failed payment attempt (card declined, bank
      // timeout, etc.) from the modal simply being dismissed, so the two
      // don't get the same generic "cancelled" message. Razorpay fires
      // payment.failed first, then still calls ondismiss once the user
      // closes the modal — this flag stops ondismiss from overwriting the
      // more specific message that's already showing.
      let paymentFailed = false;

      const checkout = new Checkout({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Skin Science with Kii",
        description: "The Acne Starter Guide",
        handler: async (response: Record<string, string>) => {
          try {
            const verifyResponse = await fetch("/api/pay/verify", {
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
            const result = (await verifyResponse.json()) as { ok?: boolean };
            if (!verifyResponse.ok || !result.ok) {
              setError(
                "We couldn't confirm your payment yet. If money was deducted, refresh in a minute or write to us — nothing is lost.",
              );
              setBusy(false);
              return;
            }
            onUnlocked();
          } catch {
            setError("We couldn't confirm your payment. Please refresh and try again.");
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            if (!paymentFailed) {
              setError("Payment was cancelled. Your guide is still waiting.");
            }
          },
        },
        theme: { color: "#c98b8b" },
      });

      checkout.on?.("payment.failed", () => {
        paymentFailed = true;
        setBusy(false);
        setError(
          "That payment didn't go through. No charge was made — please try again or use a different payment method.",
        );
      });

      checkout.open();
    } catch {
      setBusy(false);
      setError("We couldn't open the payment window. Please try again in a moment.");
    }
  }

  return (
    <div className="payment-gate">
      <div className="pay-kicker">skin science with kii</div>
      <p className="pay-title">Your full acne guide is waiting.</p>
      <p className="pay-copy">Unlock the complete Skin Science with Kii Acne Starter Guide.</p>
      <p className="price">₹399 • One-time payment</p>
      <button className="pay-btn" type="button" onClick={() => void startPayment()} disabled={busy}>
        {busy ? "Opening payment…" : "Unlock my guide — ₹399"}
      </button>

      {error ? <p className="fine-print">{error}</p> : null}
      {checking ? <p className="fine-print">One moment…</p> : null}
    </div>
  );
}
