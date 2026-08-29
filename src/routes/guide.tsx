import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Your Acne Starter Guide — Skin Science with Kii" },
      {
        name: "description",
        content:
          "Your unlocked copy of The Acne Starter Guide by Dr. Kii — evidence-informed acne care without the overwhelm.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your Acne Starter Guide — Skin Science with Kii" },
      {
        property: "og:description",
        content: "The full Acne Starter Guide, unlocked for you.",
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
  const [html, setHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/access/guide", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (cancelled) return;
        if (!response.ok) {
          setStatus("denied");
          void navigate({ to: "/" });
          return;
        }
        setHtml(await response.text());
      } catch {
        if (!cancelled) setStatus("denied");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (html) return <div dangerouslySetInnerHTML={{ __html: html }} />;

  return (
    <section className="page">
      <div className="page-pad center">
        <div className="payment-gate">
          <div className="pay-kicker">skin science with kii</div>
          <p className="pay-title">
            {status === "loading" ? "Opening your guide…" : "This guide is locked."}
          </p>
          <p className="pay-copy">
            {status === "loading"
              ? "One moment while we load your copy."
              : "Head back to the cover to unlock your copy."}
          </p>
          {status === "denied" ? (
            <a className="pay-btn" href="/">
              Back to the cover
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
