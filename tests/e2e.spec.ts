import { test, expect } from "@playwright/test";

// These tests run against a production build served locally (see
// scripts/preview-server.mjs) without real Razorpay/Supabase credentials.
// They cover routing, UI/accessibility behavior, and defensive checks that
// don't require a live payment or a real database — the things that are
// safe and meaningful to assert without secrets. They are not a substitute
// for testing a real payment end-to-end against Razorpay's test mode.

test.describe("branding and no stray Lovable/dev URLs", () => {
  test("homepage has the real title, not the Lovable placeholder", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Skin ?Science ?with ?Kii/i);
    await expect(page).not.toHaveTitle(/Lovable/i);
  });

  test("404 page uses real branding, not the Lovable placeholder", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page).not.toHaveTitle(/Lovable/i);
    await expect(page.getByText("404")).toBeVisible();
    // The 404 page's "Go home" link must be a same-site path, not an
    // absolute URL to any other host.
    const homeLink = page.getByRole("link", { name: "Go home" });
    await expect(homeLink).toHaveAttribute("href", "/");
  });

  test("no lovable.app / lovable.dev links are reachable by a customer", async ({ page }) => {
    for (const path of ["/", "/unlock"]) {
      await page.goto(path);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      for (const href of hrefs) {
        expect(href, `link on ${path}`).not.toMatch(/lovable\.(app|dev)/i);
      }
    }
  });
});

test.describe("navigation and routing", () => {
  test("homepage featured guide card links to /unlock", async ({ page }) => {
    await page.goto("/");
    const cover = page.locator(".featured-guide-card .fg-cover");
    await expect(cover).toHaveAttribute("href", "/unlock");
    const cta = page.locator(".featured-guide-card >> text=View & unlock");
    await expect(cta).toHaveAttribute("href", "/unlock");
  });

  test("existing official homepage sections are all present and in order, with the Featured Guide immediately after the hero's subscriber-count stats", async ({
    page,
  }) => {
    await page.goto("/");
    const sectionSelectors = [
      ".hero",
      "#acne-guide",
      "#about",
      "#pillars",
      "#letters",
      ".subscribe-band",
    ];
    const order = await page.evaluate((selectors: string[]) => {
      const main = document.querySelector("main");
      const sections = Array.from(main?.querySelectorAll("section") ?? []);
      return selectors.map((sel) => sections.findIndex((section) => section.matches(sel)));
    }, sectionSelectors);
    // Every section exists (no -1)...
    for (const index of order) expect(index).toBeGreaterThanOrEqual(0);
    // ...and appears in this exact relative order: the Featured Guide sits
    // right after the Hero (which contains the "267+ Lumières subscribed"
    // stat), ahead of every other pre-existing section, per the brief's
    // request to make it prominent immediately after the subscriber count.
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    }
  });

  test("nav still links to the pre-existing official sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('.nav-links a[href="#about"]')).toHaveText("About Kii");
    await expect(page.locator('.nav-links a[href="#pillars"]')).toHaveText("Approach");
    await expect(page.locator('.nav-links a[href="#letters"]')).toHaveCount(1);
  });

  test("/unlock has exactly one h1 with the guide title", async ({ page }) => {
    await page.goto("/unlock");
    const h1s = page.locator("h1");
    await expect(h1s).toHaveCount(1);
    // The title has a <br> between the two lines, which collapses to no
    // whitespace at all in the flattened text content (not just different
    // whitespace) — hence \s*, not \s+.
    await expect(h1s.first()).toContainText(/acne\s*starter guide/i);
  });

  test("/guide without a valid access cookie redirects to /unlock", async ({ page }) => {
    await page.goto("/guide");
    await page.waitForURL("**/unlock");
    await expect(page).toHaveURL(/\/unlock$/);
  });

  test("direct API access to the paid guide is denied without a cookie", async ({ request }) => {
    const response = await request.get("/api/access/guide");
    expect(response.status()).toBe(403);
  });

  test("/api/access/status reports no access with no cookie", async ({ request }) => {
    const response = await request.get("/api/access/status");
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toEqual({ hasAccess: false });
  });
});

test.describe("payment gate", () => {
  test("shows the unlock CTA with the correct price, not a fake unlock button", async ({
    page,
  }) => {
    await page.goto("/unlock");
    await expect(page.getByText("₹399 • One-time payment")).toBeVisible();
    await expect(page.getByRole("button", { name: /unlock my guide/i })).toBeVisible();
    // The old manual unlock mechanism must never exist.
    await expect(page.getByText(/i.?ve paid/i)).toHaveCount(0);
  });

  test("rejects a malformed payment verification payload", async ({ request }) => {
    const response = await request.post("/api/pay/verify", {
      data: { razorpay_order_id: "x" }, // missing required fields, fails zod validation
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  test("rejects a payment verification payload with a bad signature", async ({ request }) => {
    const response = await request.post("/api/pay/verify", {
      data: {
        razorpay_order_id: "order_fake000000",
        razorpay_payment_id: "pay_fake0000000",
        razorpay_signature: "0".repeat(64),
      },
    });
    // Either signature verification fails (401) or credentials aren't
    // configured in this environment (500) — both are "not granted access",
    // never a 2xx.
    expect(response.ok()).toBeFalsy();
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  test("webhook rejects a request with an invalid signature", async ({ request }) => {
    const response = await request.post("/api/public/razorpay/webhook", {
      data: { event: "payment_link.paid" },
      headers: { "x-razorpay-signature": "not-a-real-signature" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("access/claim rejects a malformed payment id on the polling check", async ({ request }) => {
    const response = await request.get("/api/access/claim?check=1&razorpay_payment_id=not-valid");
    expect(response.status()).toBe(400);
  });
});

test.describe("new-guide popup", () => {
  // No storage setup needed here: Playwright gives every test its own
  // isolated browser context, so sessionStorage already starts empty. An
  // earlier version of this suite cleared it via addInitScript in a
  // beforeEach — which re-runs on every navigation within a test, including
  // a deliberate page.reload(), silently erasing the very "dismissed"
  // state the reload test below is trying to verify survives a reload.

  async function openPopup(page: import("@playwright/test").Page) {
    await page.goto("/");
    await page.waitForTimeout(3000);
    return page.getByRole("dialog");
  }

  test("appears after a delay with the right content and destination", async ({ page }) => {
    const dialog = await openPopup(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.getByText("New from Skin Science with Kii")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "The Acne Starter Guide" })).toBeVisible();
    await expect(dialog.getByText("₹399")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Explore the guide" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Maybe later" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();
  });

  test("reuses the featured card's image instead of shipping a duplicate", async ({ page }) => {
    await openPopup(page);
    const [cardSrc, popupSrc] = await Promise.all([
      page.locator(".featured-guide-card .fg-cover img").getAttribute("src"),
      page.locator(".guide-popup-cover").getAttribute("src"),
    ]);
    expect(popupSrc).toBe(cardSrc);
  });

  test("Escape closes it and unlocks body scroll", async ({ page }) => {
    const dialog = await openPopup(page);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).not.toBe("hidden");
  });

  test("backdrop click closes it", async ({ page }) => {
    const dialog = await openPopup(page);
    await page.mouse.click(5, 5);
    await expect(dialog).toHaveCount(0);
  });

  test('"Explore the guide" navigates to /unlock', async ({ page }) => {
    const dialog = await openPopup(page);
    await dialog.getByRole("button", { name: "Explore the guide" }).click();
    await page.waitForURL("**/unlock");
  });

  test("dismissal is remembered for the session (does not re-show on reload)", async ({ page }) => {
    // This test opens the popup twice (once before and once after reload),
    // each involving the same ~2.5s open delay as every other popup test —
    // give it more headroom than the default per-test timeout.
    test.setTimeout(60_000);
    const dialog = await openPopup(page);
    await dialog.getByRole("button", { name: "Maybe later" }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(3000);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("focus trap keeps Tab cycling inside the dialog", async ({ page }) => {
    const dialog = await openPopup(page);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() =>
        document.querySelector('[role="dialog"]')?.contains(document.activeElement),
      );
      expect(inside).toBe(true);
    }
  });
});

test.describe("SEO/social metadata", () => {
  test("homepage declares an og:image", async ({ page, request }) => {
    await page.goto("/");
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toBeTruthy();
    const response = await request.get(ogImage!);
    expect(response.ok()).toBeTruthy();
  });

  test("/guide is marked noindex (paid content must not be crawlable)", async ({ page }) => {
    await page.goto("/guide");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toBe("noindex");
  });
});
