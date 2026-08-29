import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import coverTop from "../../content/cover-top.html?raw";
import coverBottom from "../../content/cover-bottom.html?raw";

const COVER_HTML = `${coverTop}<div id="kii-pay-slot"></div>${coverBottom}`;

// The existing, working ₹399 Razorpay Payment Link. Buyers pay on Razorpay's
// hosted page; access is granted only after server-side verification.
const PAYMENT_LINK_URL = "https://rzp.io/rzp/DnSVNzC";

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

function GuidePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "locked" | "unlocked">("checking");
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

    void check(params.get("welcome") === "1");
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
      <PaymentCard checking={state === "checking"} error={error} />
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

function PaymentCard({ checking, error }: { checking: boolean; error: string | null }) {
  return (
    <div className="payment-gate">
      <div className="pay-kicker">skin science with kii</div>
      <p className="pay-title">Your full acne guide is waiting.</p>
      <p className="pay-copy">Unlock the complete Skin Science with Kii Acne Starter Guide.</p>
      <p className="price">₹399 • One-time payment</p>
      <a className="pay-btn" href={PAYMENT_LINK_URL}>
        Buy the Acne Guide — ₹399
      </a>

      {error ? <p className="fine-print">{error}</p> : null}
      {checking ? <p className="fine-print">One moment…</p> : null}
    </div>
  );
}
