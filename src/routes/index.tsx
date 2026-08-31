import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import homeHtml from "../../content/home.html?raw";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkinSciencewithKii | Evidence-Based Skin, Hair & Dermatology" },
      {
        name: "description",
        content:
          "Evidence-based dermatology, skincare, acne, pigmentation and hair health explained simply by Kii — plus The Acne Starter Guide.",
      },
      {
        property: "og:title",
        content: "SkinSciencewithKii | Evidence-Based Skin, Hair & Dermatology",
      },
      {
        property: "og:description",
        content:
          "Skin, hair and dermatology explained simply by Kii, a junior resident in dermatology.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: homeHtml }} />
      <GuidePopup />
    </>
  );
}

// Suppresses the popup for the rest of this browser tab's session once the
// visitor has seen it — dismissing it (any of the four ways) or following it
// to the guide both count. A fresh session (new tab) will see it again.
const POPUP_SEEN_KEY = "kii_guide_popup_seen";

function hasSeenPopup(): boolean {
  try {
    return sessionStorage.getItem(POPUP_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markPopupSeen(): void {
  try {
    sessionStorage.setItem(POPUP_SEEN_KEY, "1");
  } catch {
    // Storage can be unavailable (private browsing, disabled cookies, etc.)
    // — the popup just won't remember it was dismissed. Not worth blocking on.
  }
}

const FOCUSABLE_SELECTOR = 'button, a[href], [tabindex]:not([tabindex="-1"])';

function GuidePopup() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (hasSeenPopup()) return;

    // Reuse the featured guide card's cover image instead of shipping a
    // second copy of the (large, base64-embedded) cover art.
    const cover = document.querySelector<HTMLImageElement>(".featured-guide-card .fg-cover img");
    if (cover?.src) setCoverSrc(cover.src);

    const timer = window.setTimeout(() => setOpen(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setOpen(false);
    markPopupSeen();
  };

  const goToGuide = () => {
    markPopupSeen();
    setOpen(false);
    void navigate({ to: "/unlock" });
  };

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="guide-popup-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        className="guide-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-popup-title"
        aria-describedby="guide-popup-desc"
        tabIndex={-1}
      >
        <button type="button" className="guide-popup-close" aria-label="Close" onClick={dismiss}>
          ×
        </button>
        {coverSrc ? (
          <img className="guide-popup-cover" src={coverSrc} alt="The Acne Starter Guide cover" />
        ) : null}
        <div>
          <span className="guide-popup-label">New guide</span>
          <h2 id="guide-popup-title">The Acne Starter Guide</h2>
          <p id="guide-popup-desc">
            A simple, evidence-based guide to understanding your acne — what is actually happening,
            what matters, and how to stop falling into the skincare rabbit hole.
          </p>
          <div className="guide-popup-actions">
            <button type="button" className="btn" onClick={goToGuide}>
              Go to the guide
            </button>
            <button type="button" className="guide-popup-later" onClick={dismiss}>
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
