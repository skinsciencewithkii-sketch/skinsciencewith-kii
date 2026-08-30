import { createFileRoute } from "@tanstack/react-router";

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
  return <div dangerouslySetInnerHTML={{ __html: homeHtml }} />;
}
