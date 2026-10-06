import { test, expect, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { randomUUID } from "node:crypto";
async function age(page: Page) {
  const dialog = page.locator("dialog");
  if (await dialog.count()) {
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Enter your world" }).click();
    await expect(dialog).toHaveCount(0);
  }
}
async function confirm(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm demo payment" }).click();
  await expect(dialog).toHaveCount(0);
}
async function login(page: Page, email: string) {
  await page.goto("/login");
  await age(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("VeloraDemo!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/feed/);
}
test("visitor → signup → discover → subscribe → PPV → chat → paid message", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await age(page);
  await expect(
    page.getByRole("heading", { name: /Not ordinary/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Flow Tester");
  await page
    .getByLabel("Email address")
    .fill(`flow-${randomUUID()}@velora.test`);
  await page.getByLabel("Password", { exact: true }).fill("VeloraDemo!2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(page).toHaveURL(/\/app\/feed/);
  await page.goto("/explore");
  await expect(page.locator(".creator-card")).toHaveCount(8);
  await page.getByLabel("Search creators").fill("Isadora");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".creator-card")).toHaveCount(1);
  await page.getByRole("link", { name: "Meet Isadora Sol" }).click();
  const creator = await db.creator.findUniqueOrThrow({
    where: { slug: "isadora-sol" },
    include: { posts: { include: { media: true } }, plans: true },
  });
  const premium = creator.posts.find((p) => p.visibility === "SUBSCRIBER")!;
  const ppv = creator.posts.find((p) => p.visibility === "PPV")!;
  expect(
    (await page.request.get(`/api/media/${premium.media[0].mediaId}`)).status(),
  ).toBe(403);
  await page.getByRole("button", { name: "Favorite creator" }).click();
  await expect(
    page.getByRole("button", { name: "Remove favorite" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Join the inner circle", exact: true })
    .click();
  await confirm(page);
  await expect(
    page.getByRole("link", { name: /You’re in the inner circle/ }),
  ).toBeVisible();
  expect(
    (await page.request.get(`/api/media/${premium.media[0].mediaId}`)).status(),
  ).toBe(200);
  expect(
    (await page.request.get(`/api/media/${ppv.media[0].mediaId}`)).status(),
  ).toBe(403);
  await page.getByRole("button", { name: /Unlock · €9.99/ }).click();
  await confirm(page);
  expect(
    (await page.request.get(`/api/media/${ppv.media[0].mediaId}`)).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Start a conversation" }).click();
  await expect(page).toHaveURL(/conversation=/);
  await page.getByLabel("Your message").fill("Hello, call me Alex");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.locator(".message-bubble").filter({ hasText: "fictional AI creator" }),
  ).toBeVisible();
  await page
    .getByLabel("Your message")
    .fill("Tell me about your favorite design inspiration");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("button", { name: /Unlock private note/ }),
  ).toBeVisible();
  const conversationId = new URL(page.url()).searchParams.get("conversation")!;
  const raw = await db.message.findFirstOrThrow({
    where: { conversationId, type: "LOCKED" },
  });
  const exported = await page.request.get("/api/export");
  expect(await exported.text()).not.toContain(raw.body);
  await page.getByRole("button", { name: /Unlock private note/ }).click();
  await confirm(page);
  await expect(
    page.getByRole("button", { name: /Unlock private note/ }),
  ).toHaveCount(0);
  await expect(page.getByText(/A private lifestyle note/)).toBeVisible();
  await page.goto("/app/notifications");
  await expect(page.locator(".list-card").first()).toBeVisible();
  await page.goto("/app/favorites");
  await expect(page.locator(".creator-card")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("admin → metrics → creator management → generation review → post → moderation → audit", async ({
  page,
}) => {
  await login(page, "admin@velora.test");
  await page.goto("/admin");
  await expect(
    page.getByText("Registered users", { exact: true }),
  ).toBeVisible();
  await page.goto("/admin/creators");
  await page.getByRole("button", { name: "Manage creator" }).first().click();
  await page.getByRole("button", { name: "Save creator settings" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/admin/generation");
  const brief = `A safe abstract coastal art study ${randomUUID()}`;
  await page.getByLabel("Creative brief", { exact: true }).fill(brief);
  await page.getByRole("button", { name: "Generate for review" }).click();
  const row = page.locator(".generation-item").filter({ hasText: brief });
  await expect(row).toContainText("REVIEW");
  await row.getByRole("button", { name: "Approve asset" }).click();
  await expect(row).toContainText("APPROVED");
  const job = await db.generationJob.findFirstOrThrow({
    where: { prompt: { prompt: brief } },
    include: { assets: true, creator: true },
  });
  const media = await db.creatorMedia.findUniqueOrThrow({
    where: { generationAssetId: job.assets[0].id },
  });
  await page.goto("/admin/posts");
  await page
    .getByRole("combobox", { name: "Creator", exact: true })
    .selectOption(job.creatorId);
  await page
    .getByRole("combobox", { name: "Approved asset", exact: true })
    .selectOption(media.id);
  const title = `A reviewed chapter ${randomUUID()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByLabel("Post copy")
    .fill("A safe, original abstract AI art study approved by the studio.");
  await page.getByRole("checkbox", { name: /Approve and publish/ }).check();
  await page.getByRole("button", { name: "Create approved post" }).click();
  await expect(
    page.getByRole("cell", { name: title, exact: true }),
  ).toBeVisible();
  const post = await db.creatorPost.findFirstOrThrow({ where: { title } });
  const report = await page.request.post("/api/actions", {
    headers: { Origin: process.env.E2E_BASE_URL || "http://localhost:3000" },
    data: {
      action: "report",
      targetType: "POST",
      targetId: post.id,
      reason: "Other",
      detail: `Review ${title}`,
    },
  });
  expect(report.status()).toBe(200);
  await page.goto("/admin/reports");
  const reportCard = page
    .locator(".admin-card")
    .filter({ hasText: `Review ${title}` });
  await reportCard.getByRole("button", { name: "Review report" }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("ACTIONED");
  await page
    .getByRole("combobox", { name: "Enforcement", exact: true })
    .selectOption("HIDE");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Test takedown decision recorded for audit validation.");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(reportCard).toContainText("ACTIONED");
  await page.goto(`/creators/${job.creator.slug}`);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/audit");
  await expect(
    page
      .getByRole("cell", { name: "GENERATION_APPROVED", exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "REPORT", exact: true }).first(),
  ).toBeVisible();
});
test("authorization, CSRF and webhook signature protections", async ({
  page,
}) => {
  await page.goto("/");
  await age(page);
  const c = await db.creator.findUniqueOrThrow({
    where: { slug: "isadora-sol" },
    include: { posts: { include: { media: true } } },
  });
  const post = c.posts.find((p) => p.visibility === "SUBSCRIBER")!;
  expect(
    (await page.request.get(`/api/media/${post.media[0].mediaId}`)).status(),
  ).toBe(403);
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: process.env.E2E_BASE_URL || "http://localhost:3000" },
    data: {
      name: "Security Tester",
      email: `security-${randomUUID()}@velora.test`,
      password: "VeloraDemo!2026",
      role: "ADMIN",
    },
  });
  expect(signup.ok()).toBe(true);
  const user = (await signup.json()).user;
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: user.id } })).role,
  ).toBe("USER");
  expect(
    (
      await page.request.post("/api/age", {
        headers: {
          Origin: process.env.E2E_BASE_URL || "http://localhost:3000",
        },
        data: { confirmed: true, acceptTerms: true },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/admin", {
        headers: {
          Origin: process.env.E2E_BASE_URL || "http://localhost:3000",
        },
        data: {
          action: "generate",
          creatorId: c.id,
          type: "IMAGE",
          brief: "Safe abstract art study",
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/actions", {
        headers: { Origin: "https://attacker.example" },
        data: { action: "favorite", creatorId: c.id },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/webhooks/payment", {
        headers: { "x-payment-signature": "forged" },
        data: { eventId: "x" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.get("/api/admin/media/" + post.media[0].mediaId)
    ).status(),
  ).toBe(403);
});
