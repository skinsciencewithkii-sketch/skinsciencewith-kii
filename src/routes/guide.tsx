import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/guide")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your Acne Starter Guide — Skin Science with Kii" },
      {
        name: "description",
        content:
          "Your unlocked copy of the Skin Science with Kii Acne Starter Guide by Dr. Kii.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your Acne Starter Guide — Skin Science with Kii" },
      {
        property: "og:description",
        content: "The full Acne Starter Guide, unlocked after your ₹399 purchase.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: "/guide.css" }],
  }),
  component: GuideReader,
});

// The paid guide markup is fetched from the protected endpoint; a visitor
// without a verified purchase gets 403 and is sent back to the cover.
function GuideReader() {
  const navigate = useNavigate();
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/access/guide", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) void navigate({ to: "/", search: { locked: "1" } as never });
          return;
        }
        const markup = await response.text();
        if (!cancelled) setHtml(markup);
      } catch {
        if (!cancelled) void navigate({ to: "/", search: { locked: "1" } as never });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!html) {
    return (
      <div className="payment-gate">
        <div className="pay-kicker">skin science with kii</div>
        <p className="pay-title">Opening your guide…</p>
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
