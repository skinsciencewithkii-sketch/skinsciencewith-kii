import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPending(params.get("pending") === "1");
    void loadAccess();
  }, []);

  // The cover markup is injected as HTML; keep the portal target in sync in
  // case React re-creates that subtree.
  useEffect(() => {
    const find = () => {
      const node = document.getElementById("kii-pay-slot");
      setSlot((prev) => (prev && prev.isConnected && prev === node ? prev : node));
    };
    find();
    const timer = window.setInterval(find, 400);
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
      <PaymentCard checking={state === "checking"} pending={pending} onRestored={loadAccess} />
    );

  return (
    <>
      <div ref={coverRef} dangerouslySetInnerHTML={{ __html: COVER_HTML }} />
      {slot ? createPortal(card, slot) : null}
      {paidHtml ? <div dangerouslySetInnerHTML={{ __html: paidHtml }} /> : null}
    </>
  );
}


function PaymentCard({
  checking,
  pending,
  onRestored,
}: {
  checking: boolean;
  pending: boolean;
  onRestored: () => Promise<void>;
}) {
  const [showRestore, setShowRestore] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function restore(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/access/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ identifier }),
      });
      const data = (await res.json()) as { hasAccess: boolean };
      if (data.hasAccess) {
        await onRestored();
      } else {
        setMessage("We couldn't find an order with those details yet.");
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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

      {showRestore ? (
        <form className="restore-form" onSubmit={restore}>
          <input
            className="restore-input"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Email or phone used at checkout"
            aria-label="Email or phone used at checkout"
          />
          <button className="restore-submit" type="submit" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
          {message ? <p className="fine-print">{message}</p> : null}
        </form>
      ) : (
        <button className="restore-link" type="button" onClick={() => setShowRestore(true)}>
          Already purchased?
        </button>
      )}
    </div>
  );
}
