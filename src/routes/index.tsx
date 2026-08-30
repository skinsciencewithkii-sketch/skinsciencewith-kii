import { createFileRoute } from "@tanstack/react-router";

import homeHtml from "../../content/home.html?raw";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Skin Science with Kii — Evidence-Informed Skincare" },
      {
        name: "description",
        content:
          "Skin science made simple by Dr. Kii — honest, evidence-informed skincare, plus The Acne Starter Guide.",
      },
      { property: "og:title", content: "Skin Science with Kii — Evidence-Informed Skincare" },
      {
        property: "og:description",
        content: "Understand your skin without the noise. Featuring The Acne Starter Guide.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return <div dangerouslySetInnerHTML={{ __html: homeHtml }} />;
}
