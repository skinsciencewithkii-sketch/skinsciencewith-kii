import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import coverTop from "../../content/cover-top.html?raw";
import coverBottom from "../../content/cover-bottom.html?raw";

const COVER_HTML = `${coverTop}<div id="kii-pay-slot"></div>${coverBottom}`;


const PAYMENT_LINK = "https://rzp.io/rzp/DnSVNzC";

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
  const [state, setState] = useState<"checking" | "locked" | "unlocked">("checking");
  const [paidHtml, setPaidHtml] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const coverRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPending = params.get("pending") === "1";
    const paymentId = params.get("payment_id");
    setPending(isPending);

    let cancelled = false;
    const wait = (milliseconds: number) =>
      new Promise((resolve) => window.setTimeout(resolve, milliseconds));

    const checkAccess = async () => {
      await loadAccess();
      if (!isPending || !paymentId || !/^pay_[A-Za-z0-9]{6,64}$/.test(paymentId)) return;

      // Razorpay's browser redirect can beat its verified webhook. Keep the
      // payment id only long enough to wait for the server-recorded purchase;
      // the id alone never grants access.
      for (let attempt = 0; attempt < 45 && !cancelled; attempt++) {
        try {
          const response = await fetch(
            `/api/access/claim?check=1&razorpay_payment_id=${encodeURIComponent(paymentId)}`,
            { credentials: "same-origin", cache: "no-store" },
          );
          if (response.ok) {
            const result = (await response.json()) as { hasAccess: boolean };
            if (result.hasAccess) {
              window.history.replaceState({}, "", "/?welcome=1");
              setPending(false);
              await loadAccess();
              return;
            }
          }
        } catch {
          // A transient network failure should not stop payment confirmation.
        }
        await wait(2_000);
      }
    };

    void checkAccess();
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


  async function loadAccess() {
    try {
      const res = await fetch("/api/access/status", { credentials: "same-origin" });
      const data = (await res.json()) as { hasAccess: boolean };
      if (!data.hasAccess) {
        setState("locked");
        return;
      }
      const guide = await fetch("/api/access/guide", { credentials: "same-origin" });
      if (!guide.ok) {
        setState("locked");
        return;
      }
      setPaidHtml(await guide.text());
      setState("unlocked");
    } catch {
      setState("locked");
    }
  }

  const card =
    state === "unlocked" ? (
      <div className="payment-gate">
        <div className="pay-kicker">skin science with kii</div>
        <p className="pay-title">You're in. Let's understand your acne.</p>
        <p className="pay-copy">Your full guide is just below.</p>
      </div>
    ) : (
      <PaymentCard checking={state === "checking"} pending={pending} />
    );

  return (
    <>
      <div ref={coverRef} dangerouslySetInnerHTML={{ __html: COVER_HTML }} />
      <div ref={cardRef} style={{ display: "contents" }}>
        {card}
      </div>
      {paidHtml ? <div dangerouslySetInnerHTML={{ __html: paidHtml }} /> : null}
    </>
  );

}


function PaymentCard({ checking, pending }: { checking: boolean; pending: boolean }) {
  return (
    <div className="payment-gate">
      <div className="pay-kicker">skin science with kii</div>
      <p className="pay-title">Your full acne guide is waiting.</p>
      <p className="pay-copy">Unlock the complete Skin Science with Kii Acne Starter Guide.</p>
      <p className="price">₹399 • One-time payment</p>
      <a className="pay-btn" href={PAYMENT_LINK}>
        Unlock my guide — ₹399
      </a>

      {pending ? (
        <p className="fine-print">
          Thank you — we're confirming your order. Refresh this page in a moment.
        </p>
      ) : null}

      {checking ? <p className="fine-print">One moment…</p> : null}
    </div>
  );
}
