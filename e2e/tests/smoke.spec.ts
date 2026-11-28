import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const api = "http://127.0.0.1:3000/api/v1";
const fixturePassword = "PulseDemo!2026";
const focusByKeyboard = async (
  page: import("@playwright/test").Page,
  locator: import("@playwright/test").Locator,
) => {
  for (let index = 0; index < 80; index += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Keyboard navigation could not reach the requested control.");
};

const typeByKeyboard = async (
  page: import("@playwright/test").Page,
  locator: import("@playwright/test").Locator,
  value: string,
) => {
  await focusByKeyboard(page, locator);
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(value);
};

const activateByKeyboard = async (
  page: import("@playwright/test").Page,
  locator: import("@playwright/test").Locator,
) => {
  await focusByKeyboard(page, locator);
  await page.keyboard.press("Enter");
};

const signInByKeyboard = async (
  page: import("@playwright/test").Page,
  email: string,
) => {
  await page.goto("/auth/login");
  const emailInput = page.getByLabel("Email address");
  await typeByKeyboard(page, emailInput, email);
  await page.keyboard.press("Tab");
  const passwordInput = page.getByLabel("Password", { exact: true });
  await expect(passwordInput).toBeFocused();
  await page.keyboard.insertText(fixturePassword);
  const signIn = page.getByRole("button", { name: "Sign in" });
  await focusByKeyboard(page, signIn);
  const response = page.waitForResponse(
    (candidate) => candidate.url().endsWith("/api/v1/auth/session/signin") && candidate.request().method() === "POST",
  );
  await page.keyboard.press("Enter");
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/dashboard/);
};
const redact = (value: string) =>
  value
    .replace(/(\/portals\/share\/)[^/\s?]+/g, "$1[redacted]")
    .replace(/(\/v\/)[^/\s?]+/g, "$1[redacted]")
    .replace(/(\/share\/)[^/\s?]+/g, "$1[redacted]")
    .replace(/(\/share-links\/public\/)[^/\s?]+/g, "$1[redacted]")
    .replace(
      /([?&](?:token|access_token|refresh_token|code|state)=)[^&\s]+/gi,
      "$1[redacted]",
    )
    .replace(
      /("?(?:accessToken|refreshToken|access_token|refresh_token)"?\s*:\s*")[^"]+/gi,
      "$1[redacted]",
    );

const takeSafeScreenshot = async (
  page: import("@playwright/test").Page,
): Promise<Buffer | undefined> => {
  try {
    await page.locator('input[type="password"]').evaluateAll((inputs) => {
      for (const input of inputs) (input as HTMLInputElement).value = "";
    });
    return await page.screenshot({ fullPage: true });
  } catch {
    return undefined;
  }
};

test("agency creates persistent client portal and other workspace remains denied", async ({
  page,
  browser,
}, testInfo) => {
  const steps: string[] = [];
  const responses: Array<{
    method: string;
    status: number;
    url: string;
    body?: string;
  }> = [];
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(redact(message.text()));
  });
  page.on("pageerror", (error) => consoleErrors.push(redact(error.message)));
  page.on("requestfailed", (request) =>
    requestFailures.push(
      `${request.method()} ${redact(request.url())}: ${request.failure()?.errorText || "failed"}`,
    ),
  );
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    const entry: {
      method: string;
      status: number;
      url: string;
      body?: string;
    } = {
      method: response.request().method(),
      status: response.status(),
      url: redact(url),
    };
    if (response.status() >= 400) {
      try {
        entry.body = redact((await response.text()).slice(0, 1200));
      } catch {
        entry.body = "[unavailable]";
      }
    }
    responses.push(entry);
  });

  try {
    await test.step("agency signs in with deterministic local fixture", async () => {
      steps.push("open login");
      await page.goto("/auth/login");
      await page
        .getByPlaceholder("you@example.com")
        .fill("owner@northstar.invalid");
      await page.getByPlaceholder("••••••••").fill(fixturePassword);
      const signin = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v1/auth/session/signin") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: /sign in/i }).click();
      const signinResponse = await signin;
      expect(signinResponse.status()).toBe(200);
      const signinContract = await signinResponse.json();
      expect(signinContract).toMatchObject({ success: true, statusCode: 200 });
      expect(signinContract.data).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({
            workspaceId: "00000000-0000-4000-8000-000000000001",
          }),
        }),
      );
      expect(signinContract.data).not.toHaveProperty("accessToken");
      expect(signinContract.data).not.toHaveProperty("refreshToken");
      await expect(page).toHaveURL(/dashboard/);
      await expect(
        page.getByRole("button", { name: "Create demo client portal" }),
      ).toBeVisible();
      await page.goto("/dashboard/onboarding");
      await expect(page.getByRole("heading", { name: "Onboarding and templates" })).toBeVisible();
      const consent = page.getByLabel(/Allow anonymous onboarding milestones/);
      await consent.check();
      await expect(page.getByText(/Optional funnel analytics enabled/)).toBeVisible();
      steps.push("agency authenticated");
    });

    const tokenKeys = await page.evaluate(() =>
      ["access_token", "accessToken", "refresh_token", "refreshToken"].filter(
        (key) => localStorage.getItem(key) || sessionStorage.getItem(key),
      ),
    );
    expect(tokenKeys, "browser storage must not persist credentials").toEqual(
      [],
    );
    const browserSurface = await page.evaluate(() => ({
      url: window.location.href,
      referrer: document.referrer,
      historyState: JSON.stringify(history.state),
    }));
    const credentialPattern = /(?:access[_-]?token|refresh[_-]?token|bearer)=/i;
    expect(browserSurface.url).not.toMatch(credentialPattern);
    expect(browserSurface.referrer).not.toMatch(credentialPattern);
    expect(browserSurface.historyState).not.toMatch(credentialPattern);
    const cookieState = await page.context().cookies();
    expect(
      cookieState.find((cookie) => cookie.name === "pulse_access")?.httpOnly,
    ).toBe(true);
    expect(
      cookieState.find((cookie) => cookie.name === "pulse_refresh")?.httpOnly,
    ).toBe(true);
    const secondAgencyTab = await page.context().newPage();
    await secondAgencyTab.goto("/dashboard");
    const secondTabSessionStatus = await secondAgencyTab.evaluate(
      async () =>
        (
          await fetch("http://127.0.0.1:3000/api/v1/auth/me", {
            credentials: "include",
          })
        ).status,
    );
    expect(secondTabSessionStatus).toBe(200);

    await test.step("two tabs refresh through one rotated cookie session", async () => {
      const oldRefreshCookie = (await page.context().cookies()).find(
        (cookie) => cookie.name === "pulse_refresh",
      );
      expect(oldRefreshCookie?.value).toBeTruthy();
      await page.context().clearCookies({ name: "pulse_access" });
      await Promise.all([page.reload(), secondAgencyTab.reload()]);
      await expect(
        page.getByRole("button", { name: "Create demo portal" }),
      ).toBeVisible();
      await expect
        .poll(() =>
          secondAgencyTab.evaluate(
            async () =>
              (
                await fetch("http://127.0.0.1:3000/api/v1/auth/me", {
                  credentials: "include",
                })
              ).status,
          ),
        )
        .toBe(200);

      const rotatedCookie = (await page.context().cookies()).find(
        (cookie) => cookie.name === "pulse_refresh",
      );
      expect(rotatedCookie?.value).toBeTruthy();
      expect(rotatedCookie?.value).not.toBe(oldRefreshCookie?.value);
      const replay = await page.request.post(`${api}/auth/session/refresh`, {
        headers: {
          Cookie: `pulse_refresh=${oldRefreshCookie?.value}`,
          Origin: "http://127.0.0.1:3001",
          "X-CSRF-Token": "browser-session",
        },
      });
      responses.push({
        method: "POST",
        status: replay.status(),
        url: `${api}/auth/session/refresh`,
      });
      expect(replay.status()).toBe(401);
      steps.push(
        "both tabs retained the session; replayed refresh credential was rejected",
      );
    });
    let portal!: {
      portalId: string;
      shareToken: string;
      clientPath: string;
      isDemo: boolean;
    };

    await test.step("agency creates the clearly marked demo client portal", async () => {
      steps.push("create demo portal");
      const creation = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v1/portals/demo") &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Create demo portal" })
        .click();
      const response = await creation;
      expect(response.status()).toBe(201);
      const payload = await response.json();
      portal = payload.data;
      expect(portal.isDemo).toBe(true);
      expect(portal.portalId).toBeTruthy();
      expect(portal.shareToken).toBeTruthy();
      expect(portal.clientPath).toContain("/v/");
      await expect(page.getByRole("button", { name: "Copy invitation link" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open client view" })).toHaveAttribute("href", portal.clientPath);
      await expect(page.getByText(/3 of 7 milestones recorded/)).toBeVisible();
      steps.push("demo portal response validated");

      const integrationListResponse = await page.request.get(
        `${api}/integrations/workspace/00000000-0000-4000-8000-000000000001`,
      );
      expect(integrationListResponse.status()).toBe(200);
      const integrationListPayload = await integrationListResponse.json();
      const integrationList =
        integrationListPayload.data || integrationListPayload;
      const demoIntegration = integrationList.find(
        (item: { provider: string }) => item.provider === "DEMO",
      );
      expect(demoIntegration).toBeTruthy();
      const integrationDetailResponse = await page.request.get(
        `${api}/integrations/${demoIntegration.id}`,
      );
      expect(integrationDetailResponse.status()).toBe(200);
      const integrationDetailPayload = await integrationDetailResponse.json();
      const integrationDetail =
        integrationDetailPayload.data || integrationDetailPayload;
      const connectorJson = JSON.stringify(integrationDetail);
      expect(connectorJson).not.toMatch(
        /accessToken|refreshToken|workspaceId|DEMO_ONLY_NO_CREDENTIAL/i,
      );
      expect(integrationDetail.connectionState).toBe("CONNECTED");

      const foreignConnectorPaths = [
        `/integrations/00000000-0000-4000-8000-000000000042`,
        `/integrations/00000000-0000-4000-8000-000000000042/refresh`,
        `/integrations/00000000-0000-4000-8000-000000000042/sync`,
        `/integrations/00000000-0000-4000-8000-000000000042/fetch`,
      ];
      expect(
        (await page.request.get(`${api}${foreignConnectorPaths[0]}`)).status(),
      ).toBe(403);
      for (const path of foreignConnectorPaths.slice(1)) {
        expect(
          (
            await page.request.post(`${api}${path}`, {
              headers: {
                Origin: "http://127.0.0.1:3001",
                "X-CSRF-Token": "browser-session",
              },
              data: path.endsWith("/fetch") ? { dataType: "repos" } : {},
            })
          ).status(),
        ).toBe(403);
      }
      expect(
        (
          await page.request.delete(`${api}${foreignConnectorPaths[0]}`, {
            headers: {
              Origin: "http://127.0.0.1:3001",
              "X-CSRF-Token": "browser-session",
            },
          })
        ).status(),
      ).toBe(403);
      const demoRefresh = await page.request.post(
        `${api}/integrations/${demoIntegration.id}/refresh`,
        {
          headers: {
            Origin: "http://127.0.0.1:3001",
            "X-CSRF-Token": "browser-session",
          },
          data: {},
        },
      );
      expect(demoRefresh.status()).toBe(201);
      expect(JSON.stringify(await demoRefresh.json())).not.toMatch(
        /accessToken|refreshToken|DEMO_ONLY_NO_CREDENTIAL/i,
      );
      steps.push(
        "connector DTO excluded credentials; workspace B connector ID denied for read, refresh, sync, fetch and disconnect",
      );
    });

    await test.step("agency publishes an explicit fictional client update", async () => {
      const updatedResponse = await page.request.patch(
        `${api}/portals/${portal.portalId}`,
        {
          headers: {
            Origin: "http://127.0.0.1:3001",
            "X-CSRF-Token": "browser-session",
          },
          data: {
            clientStatus: "ON_TRACK",
            clientStatusNote:
              "Fictional sample update for local usability checks.",
            latestDeliverable: "Fictional November campaign review",
            pendingDecision: "Approve the fictional December test budget",
          },
        },
      );
      expect(updatedResponse.status()).toBe(200);
      const updatedPayload = await updatedResponse.json();
      const updatedPortal = updatedPayload.data || updatedPayload;
      const publishResponse = await page.request.post(
        `${api}/portals/${portal.portalId}/publish`,
        {
          headers: {
            Origin: "http://127.0.0.1:3001",
            "X-CSRF-Token": "browser-session",
          },
          data: { expectedUpdatedAt: updatedPortal.updatedAt },
        },
      );
      expect(publishResponse.status()).toBe(201);
      expect(JSON.stringify(await publishResponse.json())).not.toMatch(
        /workspaceId|accessToken|refreshToken/i,
      );
      steps.push(
        "fictional status, deliverable and pending decision published through the workspace portal API",
      );
    });

    await test.step("command center finds the pending decision and paginates portal records", async () => {
      const pageResponse = await page.request.get(
        `${api}/portals?page=1&pageSize=1`,
      );
      expect(pageResponse.status()).toBe(200);
      const pageContract = (await pageResponse.json()).data;
      expect(pageContract).toMatchObject({ page: 1, pageSize: 1 });
      expect(pageContract.portals.length).toBeLessThanOrEqual(1);
      expect(typeof pageContract.total).toBe("number");

      const attentionResponse = await page.request.get(
        `${api}/portals/attention?page=1&pageSize=5`,
      );
      expect(attentionResponse.status()).toBe(200);
      const attentionContract = (await attentionResponse.json()).data;
      expect(
        attentionContract.items.some(
          (item: { id: string }) => item.id === portal.portalId,
        ),
      ).toBe(true);
      expect(JSON.stringify(attentionContract)).not.toMatch(
        /shareToken|publishedSnapshot|workspaceId/i,
      );

      steps.push(
        "server paging returned bounded results; attention feed exposed only summary fields and the pending decision",
      );
    });

    const client = await browser.newContext();
    const clientPage = await client.newPage();
    clientPage.on("console", (message) => {
      if (message.type() === "error")
        consoleErrors.push(redact(message.text()));
    });
    clientPage.on("pageerror", (error) =>
      consoleErrors.push(redact(error.message)),
    );
    clientPage.on("requestfailed", (request) =>
      requestFailures.push(
        `${request.method()} ${redact(request.url())}: ${request.failure()?.errorText || "failed"}`,
      ),
    );
    clientPage.on("response", (response) => {
      if (response.url().includes("/api/")) {
        responses.push({
          method: response.request().method(),
          status: response.status(),
          url: redact(response.url()),
        });
      }
    });
    try {
      await test.step("client finds status summary and cannot open agency routes", async () => {
        steps.push("client account signs in without provider credentials");
        await clientPage.goto("/auth/login");
        await clientPage
          .getByPlaceholder("you@example.com")
          .fill("client@northstar.invalid");
        await clientPage.getByPlaceholder("••••••••").fill(fixturePassword);
        await clientPage.getByRole("button", { name: /sign in/i }).click();
        await expect(clientPage).toHaveURL(/dashboard/);
        await expect(
          clientPage.getByRole("heading", { name: "Agency access required" }),
        ).toBeVisible();
        await expect(
          clientPage.getByRole("heading", { name: "Portals" }),
        ).toHaveCount(0);
        expect((await clientPage.request.get(`${api}/portals`)).status()).toBe(
          403,
        );
        expect(
          (
            await clientPage.request.get(`${api}/analytics/metric-mappings`)
          ).status(),
        ).toBe(403);
        expect(
          (
            await clientPage.request.get(
              `${api}/analytics/value-ledger?portalId=${portal.portalId}`,
            )
          ).status(),
        ).toBe(403);
        expect(
          (
            await clientPage.request.get(
              `${api}/exports/portal/${portal.portalId}/value-ledger.json`,
            )
          ).status(),
        ).toBe(403);
        const billingWrite = await clientPage.request.post(
          `${api}/billing/cancel?atPeriodEnd=true`,
          {
            headers: {
              Origin: "http://127.0.0.1:3001",
              "X-CSRF-Token": "browser-session",
            },
            data: {},
          },
        );
        expect(billingWrite.status()).toBe(403);
        const valueWrite = await clientPage.request.post(
          `${api}/analytics/value-ledger`,
          {
            headers: {
              Origin: "http://127.0.0.1:3001",
              "X-CSRF-Token": "browser-session",
            },
            data: { portalId: portal.portalId },
          },
        );
        expect(valueWrite.status()).toBe(403);
        steps.push(
          "client direct dashboard URL rendered the access block; direct portal and analytics API reads returned 403",
        );
        await clientPage.setViewportSize({ width: 390, height: 844 });
        await clientPage.route(
          `**/portals/share/${portal.shareToken}/view`,
          async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 900));
            try {
              await route.continue();
            } catch {
              /* duplicate/aborted request */
            }
          },
        );
        const slowNavigation = clientPage.goto(portal.clientPath);
        await expect(clientPage.getByRole("status")).toContainText(
          "Loading client portal",
        );
        await slowNavigation;
        await clientPage.unroute(`**/portals/share/${portal.shareToken}/view`);
        await expect(
          clientPage.getByRole("heading", { name: "Agency to Client Demo" }),
        ).toBeVisible();
        const clientStatus = clientPage.getByRole("region", {
          name: "Client status",
        });
        await expect(clientStatus).toBeVisible();
        await expect(
          clientStatus.getByRole("heading", { name: "Client status" }),
        ).toBeVisible();
        await expect(
          clientStatus.locator("dt", { hasText: "Status" }),
        ).toBeVisible();
        await expect(
          clientStatus.locator("dt", { hasText: "Last sync" }),
        ).toBeVisible();
        await expect(
          clientStatus.locator("dt", { hasText: "Latest deliverable" }),
        ).toBeVisible();
        await expect(
          clientStatus.locator("dt", { hasText: "Pending decision" }),
        ).toBeVisible();
        await expect(clientStatus).toContainText(
          "Fictional November campaign review",
        );
        await expect(clientStatus).toContainText(
          "Approve the fictional December test budget",
        );
        await expect(clientStatus).toContainText("On Track");
        await expect(
          clientPage.getByText(
            "Fictional demo data — not live provider metrics.",
          ),
        ).toBeVisible();
        await expect(clientPage.getByText("Monthly revenue")).toBeVisible();
        await expect(clientPage.getByText("$42,850")).toBeVisible();
        const mobileWidget = await clientPage
          .locator('[data-testid^="client-widget-"]')
          .first()
          .boundingBox();
        expect(mobileWidget?.width).toBeLessThan(390);
        await clientPage.setViewportSize({ width: 1440, height: 1000 });
        const desktopWidget = await clientPage
          .locator('[data-testid^="client-widget-"]')
          .first()
          .boundingBox();
        expect(desktopWidget?.width).toBeGreaterThan(mobileWidget?.width ?? 0);
        await clientPage.reload();
        await expect(clientPage.getByText("$42,850")).toBeVisible();
        const funnelStatusResponse = await page.request.get(`${api}/onboarding/status`);
        expect(funnelStatusResponse.status()).toBe(200);
        const funnelStatus = (await funnelStatusResponse.json()).data;
        expect(funnelStatus.stages.find((stage: { stage: string }) => stage.stage === "FIRST_CLIENT_VIEW")).toMatchObject({ complete: true });
        steps.push(
          "responsive status/deliverable/decision summary and screen-reader terms were present; poor-network loading state and reload persistence verified",
        );
      });
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        const screenshot = await takeSafeScreenshot(clientPage);
        if (screenshot)
          await testInfo.attach("client-failure-screenshot.png", {
            body: screenshot,
            contentType: "image/png",
          });
      }
      await client.close();
    }

    await test.step("unlisted share link protects secrets, password, expiry, rotation, and view limits", async () => {
      const makePrivate = await page.request.patch(
        `${api}/portals/${portal.portalId}`,
        {
          headers: {
            Origin: "http://127.0.0.1:3001",
            "X-CSRF-Token": "browser-session",
          },
          data: { isPublic: false },
        },
      );
      expect(makePrivate.status()).toBe(200);
      const createdResponse = await page.request.post(`${api}/share-links`, {
        headers: {
          Origin: "http://127.0.0.1:3001",
          "X-CSRF-Token": "browser-session",
        },
        data: {
          portalId: portal.portalId,
          password: "Fictional-Link-Password-42",
          maxViews: 3,
          allowComments: true,
          allowExport: true,
        },
      });
      expect(createdResponse.status()).toBe(201);
      const createdBody = await createdResponse.json();
      const created = createdBody.data || createdBody;
      expect(created.hasPassword).toBe(true);
      expect(created).not.toHaveProperty("password");
      const shareToken = created.token as string;

      const guest = await browser.newContext();
      const guestPage = await guest.newPage();
      try {
        const anonymousAccess = await guest.request.post(
          `${api}/share-links/public/${shareToken}/access`,
          {
            data: { password: "Fictional-Link-Password-42" },
          },
        );
        expect(anonymousAccess.status()).toBe(201);
        const anonymousBody = await anonymousAccess.json();
        const serialized = JSON.stringify(anonymousBody);
        expect(serialized).not.toContain("shareToken");
        expect(serialized).not.toContain("workspaceId");
        expect(serialized).not.toContain("accessToken");
        expect(serialized).not.toContain("refreshToken");
        expect(serialized).not.toContain("integrationId");
        expect(anonymousAccess.headers()["cache-control"]).toContain(
          "no-store",
        );
        const staffComments = await guest.request.get(
          `${api}/comments/portal/${portal.portalId}`,
        );
        expect(staffComments.status()).toBe(401);
        const staffExport = await guest.request.get(
          `${api}/exports/portal/${portal.portalId}/pdf`,
        );
        expect(staffExport.status()).toBe(401);
        const guestComment = await guest.request.post(
          `${api}/share-links/public/${shareToken}/comments`,
          {
            data: {
              password: "Fictional-Link-Password-42",
              displayName: "Client Reviewer",
              content: "Please confirm this fictional KPI.",
            },
          },
        );
        expect(guestComment.status()).toBe(201);
        const guestComments = await guest.request.post(
          `${api}/share-links/public/${shareToken}/comments/list`,
          {
            data: { password: "Fictional-Link-Password-42" },
          },
        );
        expect(JSON.stringify(await guestComments.json())).toContain(
          "Client Reviewer",
        );
        const shareExport = await guest.request.post(
          `${api}/share-links/public/${shareToken}/export`,
          {
            data: { password: "Fictional-Link-Password-42" },
          },
        );
        expect(shareExport.status()).toBe(201);
        const exported = JSON.stringify(await shareExport.json());
        expect(exported).toContain("Agency to Client Demo");
        expect(exported).not.toContain("workspaceId");
        expect(exported).not.toContain("integrationId");
        expect(exported).not.toContain("shareToken");

        const assignedCreateResponse = await page.request.post(
          `${api}/share-links`,
          {
            headers: {
              Origin: "http://127.0.0.1:3001",
              "X-CSRF-Token": "browser-session",
            },
            data: {
              portalId: portal.portalId,
              clientUserIds: ["00000000-0000-4000-8000-000000000012"],
            },
          },
        );
        expect(assignedCreateResponse.status()).toBe(201);
        const assignedCreatePayload = await assignedCreateResponse.json();
        const assignedLink =
          assignedCreatePayload.data || assignedCreatePayload;
        expect(
          (
            await guest.request.get(
              `${api}/share-links/public/${assignedLink.token}/check`,
            )
          ).status(),
        ).toBe(403);
        const wrongTenantAssignment = await page.request.post(
          `${api}/share-links`,
          {
            headers: {
              Origin: "http://127.0.0.1:3001",
              "X-CSRF-Token": "browser-session",
            },
            data: {
              portalId: portal.portalId,
              clientUserIds: ["00000000-0000-4000-8000-000000000021"],
            },
          },
        );
        expect(wrongTenantAssignment.status()).toBe(400);
        const assignedClient = await browser.newContext();
        const assignedClientPage = await assignedClient.newPage();
        await assignedClientPage.goto("/auth/login");
        await assignedClientPage
          .getByPlaceholder("you@example.com")
          .fill("client@northstar.invalid");
        await assignedClientPage
          .getByPlaceholder("••••••••")
          .fill(fixturePassword);
        await assignedClientPage
          .getByRole("button", { name: /sign in/i })
          .click();
        await expect(assignedClientPage).toHaveURL(/dashboard/);
        for (const path of [
          `/portals/${portal.portalId}`,
          `/widgets/portal/${portal.portalId}`,
          `/comments/portal/${portal.portalId}`,
          `/exports/portal/${portal.portalId}/pdf`,
          "/workspaces/me",
          "/api-keys",
          "/billing/subscription",
          "/integrations/workspace/00000000-0000-4000-8000-000000000001",
        ]) {
          expect(
            (await assignedClient.request.get(`${api}${path}`)).status(),
            `client must not read agency API ${path}`,
          ).toBe(403);
        }
        await assignedClientPage.goto(`/share/${assignedLink.token}`);
        await assignedClientPage
          .getByRole("button", { name: "Open portal" })
          .click();
        await expect(
          assignedClientPage.getByRole("heading", {
            name: "Agency to Client Demo",
          }),
        ).toBeVisible();
        await assignedClient.close();

        await guestPage.goto(`/share/${shareToken}`);
        const passwordField = guestPage.getByLabel("Password");
        await passwordField.fill("wrong-password");
        await guestPage.getByRole("button", { name: "Open portal" }).click();
        await expect(guestPage.getByText("Invalid password")).toBeVisible();
        await passwordField.fill("Fictional-Link-Password-42");
        await guestPage.getByRole("button", { name: "Open portal" }).click();
        await expect(
          guestPage.getByRole("heading", { name: "Agency to Client Demo" }),
        ).toBeVisible();

        const rotatedResponse = await page.request.post(
          `${api}/share-links/${created.id}/regenerate`,
          {
            headers: {
              Origin: "http://127.0.0.1:3001",
              "X-CSRF-Token": "browser-session",
            },
          },
        );
        expect(rotatedResponse.status()).toBe(201);
        const rotatedBody = await rotatedResponse.json();
        const rotated = rotatedBody.data || rotatedBody;
        expect(rotated.token).not.toBe(shareToken);
        expect(
          (
            await guest.request.get(
              `${api}/share-links/public/${shareToken}/check`,
            )
          ).status(),
        ).toBe(404);
        await guestPage.goto(`/share/${rotated.token}`);
        await expect(
          guestPage.getByRole("heading", { name: "Open shared portal" }),
        ).toBeVisible();

        const expiredResponse = await page.request.post(`${api}/share-links`, {
          headers: {
            Origin: "http://127.0.0.1:3001",
            "X-CSRF-Token": "browser-session",
          },
          data: {
            portalId: portal.portalId,
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
          },
        });
        expect(expiredResponse.status()).toBe(201);
        const expiredBody = await expiredResponse.json();
        const expired = expiredBody.data || expiredBody;
        await guestPage.goto(`/share/${expired.token}`);
        await expect(
          guestPage.getByRole("heading", {
            name: "This link is no longer available",
          }),
        ).toBeVisible();
        await guestPage
          .getByLabel("Email for the agency to reply to")
          .fill("reviewer@example.invalid");
        await guestPage.getByRole("button", { name: "Request access" }).click();
        await expect(guestPage.getByRole("status")).toContainText(
          "If this link can be matched",
        );
        const requestList = await page.request.get(
          `${api}/share-links/access-requests`,
        );
        expect(requestList.status()).toBe(200);
        const requestBody = await requestList.json();
        const requestData = requestBody.data || requestBody;
        const accessRequest = requestData.find(
          (item: { email: string }) =>
            item.email === "reviewer@example.invalid",
        );
        expect(accessRequest).toBeTruthy();
        const reviewed = await page.request.patch(
          `${api}/share-links/access-requests/${accessRequest.id}/review`,
          {
            headers: {
              Origin: "http://127.0.0.1:3001",
              "X-CSRF-Token": "browser-session",
            },
          },
        );
        expect(reviewed.status()).toBe(200);
        const privateLegacyAccess = await guest.request.get(
          `${api}/portals/share/${portal.shareToken}`,
        );
        expect(privateLegacyAccess.status()).toBe(404);
        const oldRotatedComment = await guest.request.post(
          `${api}/share-links/public/${shareToken}/comments/list`,
          { data: { password: "Fictional-Link-Password-42" } },
        );
        expect(oldRotatedComment.status()).toBe(404);
        const oldRotatedExport = await guest.request.post(
          `${api}/share-links/public/${shareToken}/export`,
          { data: { password: "Fictional-Link-Password-42" } },
        );
        expect(oldRotatedExport.status()).toBe(404);
        const removeAssignedLink = await page.request.delete(
          `${api}/share-links/${assignedLink.id}`,
          {
            headers: {
              Origin: "http://127.0.0.1:3001",
              "X-CSRF-Token": "browser-session",
            },
          },
        );
        expect(removeAssignedLink.status()).toBe(200);
        const makePublicAgain = await page.request.patch(
          `${api}/portals/${portal.portalId}`,
          {
            headers: {
              Origin: "http://127.0.0.1:3001",
              "X-CSRF-Token": "browser-session",
            },
            data: { isPublic: true },
          },
        );
        expect(makePublicAgain.status()).toBe(200);
      } finally {
        await guest.close();
      }
      steps.push(
        "password, expiry, rotation, assigned-client-only access, guest denial, public capability allowlist, export/comments and request-access review verified",
      );
    });

    await test.step("portal builder persists keyboard layout and previews safely on mobile", async () => {
      expect(
        (await page.request.get(`${api}/portals/${portal.portalId}`)).status(),
      ).toBe(200);
      const editUrl = `http://127.0.0.1:3001/dashboard/portals/${portal.portalId}/edit`;
      await page.goto(editUrl, { waitUntil: "load", timeout: 90000 });
      await expect(page).toHaveURL(/\/dashboard\/portals\/.+\/edit/);
      await expect(
        page.getByRole("heading", { name: "Portal builder" }),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        page
          .getByText("Draft", { exact: true })
          .or(page.getByText(/Published · revision/)),
      ).toBeVisible();
      const widgetNames = page.locator(
        '[aria-label="Portal widgets"] li p.font-medium',
      );
      const widgetItems = page.locator('[aria-label="Portal widgets"] li');
      const count = await widgetNames.count();
      expect(count).toBeGreaterThan(0);
      if (count > 1) {
        const before = await widgetNames.allTextContents();
        await widgetItems.nth(0).dragTo(widgetItems.nth(1));
        const dragged = await widgetNames.allTextContents();
        expect(dragged[1]).toBe(before[0]);
        await activateByKeyboard(
          page,
          page.getByRole("button", { name: `Move ${dragged[0]} down` }),
        );
        const reordered = await widgetNames.allTextContents();
        expect(reordered[1]).toBe(dragged[0]);
      }
      const saveWait = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/portals/${portal.portalId}`) &&
          response.request().method() === "PATCH",
      );
      await activateByKeyboard(page, page.getByRole("button", { name: "Save draft" }));
      const saveResponse = await saveWait;
      expect(saveResponse.status(), await saveResponse.text()).toBe(200);
      await expect(page.getByText(/Draft saved/)).toBeVisible();
      await page.reload({ waitUntil: "load" });
      await expect(
        page.getByRole("heading", { name: "Portal builder" }),
      ).toBeVisible({ timeout: 60000 });
      expect(await widgetNames.allTextContents()).toHaveLength(count);

      await page.setViewportSize({ width: 390, height: 844 });
      await activateByKeyboard(page, page.getByRole("button", { name: "Preview as client" }));
      await expect(page).toHaveURL(/previewPortalId=/);
      await expect(
        page.getByText(/Client permission preview of the current draft/),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        page.getByText(
          /Private notes, connector credentials, and agency controls are excluded/,
        ),
      ).toBeVisible();
      const clientText = await page.locator("main").innerText();
      expect(clientText).not.toMatch(
        /NEVER_COPY|privateNote|accessToken|refreshToken/i,
      );
      expect(clientText).toContain("Fictional demo data");

      await page.route(
        `**/portals/${portal.portalId}/preview**`,
        async (route) => {
          if (route.request().method() === "OPTIONS") {
            await route.fulfill({
              status: 204,
              headers: {
                "Access-Control-Allow-Origin": "http://127.0.0.1:3001",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Headers":
                  "content-type,authorization,x-csrf-token",
                "Access-Control-Allow-Methods":
                  "GET,POST,PATCH,PUT,DELETE,OPTIONS",
              },
            });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: {
              "Access-Control-Allow-Origin": "http://127.0.0.1:3001",
              "Access-Control-Allow-Credentials": "true",
            },
            body: JSON.stringify({
              success: true,
              data: {
                id: portal.portalId,
                name: "Fictional connector failure",
                description: null,
                workspaceName: "Northstar Fictional Agency",
                primaryColor: "#123456",
                viewMode: "draft-preview",
                widgets: [
                  {
                    id: "fixture-widget",
                    name: "Offline connector fixture",
                    type: "METRIC",
                    data: null,
                    sourceLabel: "Sample connector unavailable",
                    isDemo: true,
                    layout: { x: 0, y: 0, w: 12, h: 4 },
                  },
                ],
                metrics: [],
              },
            }),
          });
        },
      );
      await page.goto(
        `http://127.0.0.1:3001/v/preview?previewPortalId=${encodeURIComponent(portal.portalId)}`,
      );
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Sample connector unavailable" }),
      ).toBeVisible({ timeout: 30000 });
      await page.unroute(`**/portals/${portal.portalId}/preview**`);
      await page.setViewportSize({ width: 1280, height: 900 });
      steps.push(
        "keyboard ordering saved across reload; mobile client preview excluded private fields; mocked broken connector displayed an explicit unavailable state",
      );
    });

    await test.step("retries are idempotent and another workspace is denied", async () => {
      steps.push("verify duplicate create and tenant boundary");
      const retry = await page.request.post(`${api}/portals/demo`, {
        headers: {
          Origin: "http://127.0.0.1:3001",
          "X-CSRF-Token": "browser-session",
        },
      });
      responses.push({
        method: "POST",
        status: retry.status(),
        url: `${api}/portals/demo`,
      });
      expect(retry.status()).toBe(201);
      const retryPayload = await retry.json();
      expect(retryPayload.data.portalId).toBe(portal.portalId);
      expect(retryPayload.data.shareToken).toBe(portal.shareToken);

      const crossTenant = await page.request.get(
        `${api}/portals/00000000-0000-4000-8000-000000000031`,
      );
      responses.push({
        method: "GET",
        status: crossTenant.status(),
        url: `${api}/portals/[other-tenant-id]`,
      });
      expect(crossTenant.status()).toBe(403);
      steps.push("duplicate reused one portal; cross-tenant ID returned 403");
    });

    await test.step("bulk unpublish is bounded, deduplicated and idempotent", async () => {
      const headers = {
        Origin: "http://127.0.0.1:3001",
        "X-CSRF-Token": "browser-session",
      };
      const first = await page.request.post(`${api}/portals/bulk-unpublish`, {
        headers,
        data: { portalIds: [portal.portalId, portal.portalId] },
      });
      expect(first.status()).toBe(201);
      expect((await first.json()).data).toEqual({
        requestedCount: 1,
        succeededCount: 1,
        unavailableCount: 0,
        succeededPortalIds: [portal.portalId],
      });
      const repeat = await page.request.post(`${api}/portals/bulk-unpublish`, {
        headers,
        data: { portalIds: [portal.portalId] },
      });
      expect(repeat.status()).toBe(201);
      expect((await repeat.json()).data).toEqual({
        requestedCount: 1,
        succeededCount: 0,
        unavailableCount: 1,
        succeededPortalIds: [],
      });
      const oversized = await page.request.post(
        `${api}/portals/bulk-unpublish`,
        {
          headers,
          data: {
            portalIds: Array.from(
              { length: 51 },
              (_, index) => `portal-${index}`,
            ),
          },
        },
      );
      expect(oversized.status()).toBe(400);
      steps.push(
        "duplicate IDs changed one portal once; replay was safe; request limit rejected 51 IDs",
      );
    });

    await test.step("logout-all rejects stale sessions in both tabs", async () => {
      const logoutAll = await page.request.post(`${api}/auth/logout/all`, {
        headers: {
          Origin: "http://127.0.0.1:3001",
          "X-CSRF-Token": "browser-session",
        },
      });
      expect(logoutAll.status()).toBe(200);
      await Promise.all([page.reload(), secondAgencyTab.reload()]);
      await expect(page).toHaveURL(/auth\/login/);
      expect((await page.request.get(`${api}/auth/me`)).status()).toBe(401);
      await expect(secondAgencyTab).toHaveURL(/auth\/login/);
      steps.push(
        "logout-all revoked both tabs and stale sessions returned to sign-in",
      );
      await secondAgencyTab.close();
    });
  } finally {
    await testInfo.attach("smoke-diagnostics.json", {
      body: Buffer.from(
        redact(
          JSON.stringify(
            { steps, responses, consoleErrors, requestFailures },
            null,
            2,
          ),
        ),
      ),
      contentType: "application/json",
    });
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshot = await takeSafeScreenshot(page);
      if (screenshot)
        await testInfo.attach("failure-screenshot.png", {
          body: screenshot,
          contentType: "image/png",
        });
    }
  }
});

test("decision inbox records one versioned client response and rejects stale or revoked requests", async ({ page, browser }) => {
  const clientId = '00000000-0000-4000-8000-000000000012';
  const foreignClientId = '00000000-0000-4000-8000-000000000021';
  const headers = { Origin: 'http://127.0.0.1:3001', 'X-CSRF-Token': 'browser-session' };

  await signInByKeyboard(page, 'owner@northstar.invalid');
  await page.goto('/dashboard/onboarding');
  const analyticsConsent = page.getByLabel(/Allow anonymous onboarding milestones/);
  await focusByKeyboard(page, analyticsConsent);
  if (!(await analyticsConsent.isChecked())) await page.keyboard.press('Space');
  await expect(page.getByText('Optional funnel analytics enabled.')).toBeVisible();
  const demoCreation = page.waitForResponse((response) => response.url().endsWith('/api/v1/portals/demo') && response.request().method() === 'POST');
  await activateByKeyboard(page, page.getByRole('button', { name: 'Create demo portal' }));
  const demoResponse = await demoCreation;
  expect(demoResponse.status()).toBe(201);
  const demo = (await demoResponse.json()).data;
  const portalId = demo.portalId as string;
  const demoDetailsResponse = await page.request.get(`${api}/portals`);
  const demoItems = (await demoDetailsResponse.json()).data.portals;
  const createdPortal = demoItems.find((portal: { id: string }) => portal.id === portalId);
  expect(createdPortal).toBeTruthy();
  const privatize = await page.request.patch(`${api}/portals/${portalId}`, { headers, data: { isPublic: false } });
  expect(privatize.status()).toBe(200);
  const editUrl = `/dashboard/portals/${portalId}/edit`;
  await page.goto(editUrl);
  await expect(page.getByRole('heading', { name: 'Portal builder' })).toBeVisible();
  await typeByKeyboard(page, page.getByLabel('Latest deliverable (client visible)'), 'Fictional decision inbox test revision one');
  await typeByKeyboard(page, page.getByLabel('Pending decision (client visible)'), 'Approve the fictional budget shown in the published portal?');
  const publishResponse = page.waitForResponse((response) => response.url().endsWith(`/api/v1/portals/${portalId}/publish`) && response.request().method() === 'POST');
  await activateByKeyboard(page, page.getByRole('button', { name: 'Publish snapshot' }));
  expect((await publishResponse).status()).toBe(201);
  const publishedPortalResponse = await page.request.get(`${api}/portals/${portalId}`);
  const publishedPortal = (await publishedPortalResponse.json()).data;
  const initialRevision = publishedPortal.publishRevision as number;

  const shareResponse = await page.request.post(`${api}/share-links`, {
    headers,
    data: {
      portalId,
      clientUserIds: [clientId],
      allowDecisions: true,
    },
  });
  expect(shareResponse.status()).toBe(201);
  const shareLink = (await shareResponse.json()).data;
  const firstTitle = `Fictional budget approval ${Date.now()}`;
  const secondTitle = `Fictional next revision ${Date.now()}`;
  const target = `${shareLink.id}|${clientId}`;

  await page.goto('/dashboard/decision-inbox');
  await expect(page.getByRole('heading', { name: 'Decision inbox' })).toBeVisible();
  const clientSelector = page.getByLabel('Client and portal');
  await focusByKeyboard(page, clientSelector);
  for (let index = 0; index < 8 && await clientSelector.inputValue() !== target; index += 1) {
    await page.keyboard.press('ArrowDown');
  }
  expect(await clientSelector.inputValue()).toBe(target);
  await typeByKeyboard(page, page.getByLabel('Decision title'), firstTitle);
  await typeByKeyboard(page, page.getByLabel('What should the client decide?'), 'Approve the fictional budget shown in the published portal?');
  await activateByKeyboard(page, page.getByRole('button', { name: 'Create decision request' }));
  await expect(page.getByText(firstTitle)).toBeVisible();

  const firstRowResponse = await page.request.get(`${api}/decision-inbox`);
  expect(firstRowResponse.status()).toBe(200);
  const firstRows = (await firstRowResponse.json()).data;
  const firstDecision = firstRows.find((item: { title: string }) => item.title === firstTitle);
  expect(firstDecision).toMatchObject({ status: 'OPEN', portalRevision: initialRevision });

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.addInitScript(() => {
    const windowWithShiftTotal = window as Window & { __pulseLayoutShiftTotal?: number };
    windowWithShiftTotal.__pulseLayoutShiftTotal = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!layoutShift.hadRecentInput) {
            windowWithShiftTotal.__pulseLayoutShiftTotal = (windowWithShiftTotal.__pulseLayoutShiftTotal ?? 0) + (layoutShift.value ?? 0);
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // The metric is optional on browsers without the Layout Instability API.
    }
  });
  await signInByKeyboard(clientPage, 'client@northstar.invalid');
  await clientPage.goto(`/share/${shareLink.token}`);
  await activateByKeyboard(clientPage, clientPage.getByRole('button', { name: 'Open portal' }));
  await expect(clientPage.getByRole('heading', { name: 'Decisions for your review' })).toBeVisible();
  await expect(clientPage.getByText(`Applies to published portal revision ${firstDecision.portalRevision}`)).toBeVisible();
  const mobileLayoutShift = await clientPage.evaluate(() => (window as Window & { __pulseLayoutShiftTotal?: number }).__pulseLayoutShiftTotal ?? 0);
  expect(mobileLayoutShift, 'mobile portal cumulative layout shift').toBeLessThanOrEqual(0.1);
  await typeByKeyboard(clientPage, clientPage.getByLabel(`Comment for ${firstTitle}`), 'Fictional client approval recorded.');
  for (const width of [320, 360, 390]) {
    await clientPage.setViewportSize({ width, height: 844 });
    const viewport = await clientPage.evaluate(() => ({ width: window.innerWidth, documentWidth: document.documentElement.scrollWidth }));
    expect(viewport.documentWidth, `horizontal overflow at ${width}px viewport`).toBeLessThanOrEqual(viewport.width);
  }
  const approveButton = clientPage.getByRole('button', { name: 'Approve this version' });
  await focusByKeyboard(clientPage, approveButton);
  expect(await approveButton.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe('3px');
  await clientPage.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotionDuration = await clientPage.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'animate-spin';
    document.body.appendChild(probe);
    const duration = getComputedStyle(probe).animationDuration;
    probe.remove();
    return duration;
  });
  expect(parseFloat(reducedMotionDuration)).toBeLessThan(0.001);
  for (const colorScheme of ['light', 'dark'] as const) {
    const focusContrast = await clientPage.evaluate((scheme) => {
      const root = document.documentElement;
      const previousTheme = root.className;
      root.className = scheme === 'dark' ? 'dark' : 'light';
      const button = document.querySelector<HTMLButtonElement>('button:focus-visible');
      if (!button) throw new Error('Keyboard focus was lost during the contrast check.');
      const outline = getComputedStyle(button).outlineColor.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const surface = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const luminance = (channels: number[]) => {
        const linear = channels.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const values = [luminance(outline), luminance(surface)].sort((a, b) => b - a);
      root.className = previousTheme;
      return (values[0] + 0.05) / (values[1] + 0.05);
    }, colorScheme);
    expect(focusContrast, `${colorScheme} focus outline contrast`).toBeGreaterThanOrEqual(3);
  }
  await clientPage.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await clientPage.keyboard.press('Enter');
  await expect(clientPage.getByText(/Your saved response: Approved/)).toBeVisible();
  const screenshotDirectory = resolve(__dirname, '../../docs/agent-execution/assets');
  mkdirSync(screenshotDirectory, { recursive: true });
  await clientPage.setViewportSize({ width: 390, height: 844 });
  await clientPage.screenshot({
    animations: 'disabled',
    path: resolve(screenshotDirectory, '22-after-client-approval.png'),
    fullPage: true,
  });

  const duplicate = await clientPage.request.post(
    `${api}/share-links/public/${shareLink.token}/decisions/${firstDecision.id}/respond`,
    { headers, data: { expectedRevision: firstDecision.portalRevision, response: 'APPROVE', comment: 'Fictional client approval recorded.' } },
  );
  expect(duplicate.status()).toBe(201);
  expect((await duplicate.json()).data.idempotent).toBe(true);

  await clientPage.reload();
  await activateByKeyboard(clientPage, clientPage.getByRole('button', { name: 'Open portal' }));
  await expect(clientPage.getByText(/Your saved response: Approved/)).toBeVisible();
  await page.goto('/dashboard/decision-inbox');
  await page.reload();
  const firstArticle = page.locator('article').filter({ hasText: firstTitle });
  await expect(firstArticle.getByText('Immutable client response: APPROVE')).toBeVisible();
  await activateByKeyboard(page, firstArticle.locator('summary').filter({ hasText: 'Timeline' }));
  await expect(firstArticle.getByText('CLIENT RESPONDED')).toBeVisible();
  const historyAfterRefresh = await page.request.get(`${api}/decision-inbox`);
  const refreshedDecision = (await historyAfterRefresh.json()).data.find((item: { id: string }) => item.id === firstDecision.id);
  expect(refreshedDecision.response).toMatchObject({ response: 'APPROVE', comment: 'Fictional client approval recorded.', portalRevision: initialRevision });
  expect(refreshedDecision.timeline.filter((event: { eventType: string }) => event.eventType === 'CLIENT_RESPONDED')).toHaveLength(1);
  const onboardingAfterDecision = await page.request.get(`${api}/onboarding/status`);
  const onboardingStages = (await onboardingAfterDecision.json()).data.stages;
  expect(onboardingStages.find((stage: { stage: string }) => stage.stage === 'FIRST_DECISION')).toMatchObject({ complete: true });

  await page.getByLabel('Client and portal').selectOption(target);
  await page.getByLabel('Decision title').fill(secondTitle);
  await page.getByLabel('What should the client decide?').fill('Approve the next published revision?');
  await page.getByRole('button', { name: 'Create decision request' }).click();
  await expect(page.getByText(secondTitle)).toBeVisible();
  const allDecisionsResponse = await page.request.get(`${api}/decision-inbox`);
  const allDecisions = (await allDecisionsResponse.json()).data;
  const secondDecision = allDecisions.find((item: { title: string }) => item.title === secondTitle);
  expect(secondDecision.portalRevision).toBe(firstDecision.portalRevision);

  const currentPortalResponse = await page.request.get(`${api}/portals/${portalId}`);
  const currentPortal = (await currentPortalResponse.json()).data;
  const revise = await page.request.patch(`${api}/portals/${portalId}`, {
    headers,
    data: { latestDeliverable: 'Fictional revision requiring a new client acknowledgment' },
  });
  const revisedPortal = (await revise.json()).data;
  const republish = await page.request.post(`${api}/portals/${portalId}/publish`, {
    headers,
    data: { expectedUpdatedAt: revisedPortal.updatedAt },
  });
  expect(republish.status()).toBe(201);
  expect(currentPortal.publishRevision).toBe(firstDecision.portalRevision);

  await clientPage.reload();
  await clientPage.getByRole('button', { name: 'Open portal' }).click();
  const staleRequest = clientPage.locator('article').filter({ hasText: secondTitle });
  await expect(staleRequest.getByText(/portal has changed since this request/i)).toBeVisible();
  await expect(staleRequest.getByRole('button', { name: 'Approve this version' })).toHaveCount(0);
  const staleResponse = await clientPage.request.post(
    `${api}/share-links/public/${shareLink.token}/decisions/${secondDecision.id}/respond`,
    { headers, data: { expectedRevision: secondDecision.portalRevision, response: 'APPROVE' } },
  );
  expect(staleResponse.status()).toBe(409);

  const foreignContext = await browser.newContext();
  const foreignPage = await foreignContext.newPage();
  await foreignPage.goto('/auth/login');
  await foreignPage.getByPlaceholder('you@example.com').fill('owner@juniper.invalid');
  await foreignPage.getByPlaceholder('••••••••').fill(fixturePassword);
  await foreignPage.getByRole('button', { name: /sign in/i }).click();
  const foreignRead = await foreignPage.request.post(
    `${api}/share-links/public/${shareLink.token}/decisions/list`, { headers, data: {} },
  );
  expect(foreignRead.status()).toBe(403);

  const expired = await page.request.patch(`${api}/share-links/${shareLink.id}`, {
    headers,
    data: { expiresAt: new Date(Date.now() - 60_000).toISOString() },
  });
  expect(expired.status()).toBe(200);
  const expiredRead = await clientPage.request.post(
    `${api}/share-links/public/${shareLink.token}/decisions/list`, { headers, data: {} },
  );
  expect(expiredRead.status()).toBe(403);

  await foreignContext.close();
  await clientContext.close();
});

test('approved report snapshot stays identical across email, CSV, PDF and assigned client portal', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const workspaceId = '00000000-0000-4000-8000-000000000001';
  const portalId = '00000000-0000-4000-8000-000000000032';
  const projectId = '00000000-0000-4000-8000-000000000051';
  const clientId = '00000000-0000-4000-8000-000000000012';
  const headers = { Origin: 'http://127.0.0.1:3001', 'X-CSRF-Token': 'browser-session' };
  const title = 'Fictional report parity Northstar';

  await page.goto('/auth/login');
  await page.getByPlaceholder('you@example.com').fill('owner@northstar.invalid');
  await page.getByPlaceholder('••••••••').fill(fixturePassword);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);

  const privatize = await page.request.patch(`${api}/portals/${portalId}`, {
    headers,
    data: { isPublic: false },
  });
  expect(privatize.status()).toBe(200);
  const linkResponse = await page.request.post(`${api}/share-links`, {
    headers,
    data: { portalId, clientUserIds: [clientId], allowExport: true },
  });
  if (linkResponse.status() !== 201) throw new Error(`Share link creation failed (${linkResponse.status()}): ${await linkResponse.text()}`);
  const link = (await linkResponse.json()).data;

  await page.goto('/client-reports');
  await expect(page.getByRole('heading', { name: 'Client briefings' })).toBeVisible();
  await page.getByLabel('Client portal').selectOption(portalId);
  await page.getByLabel('Reporting project').selectOption(projectId);
  await page.getByLabel('Briefing title').fill(title);
  await expect(page.getByLabel('Client name')).toHaveValue('Northstar Fictional Client');
  await page.getByLabel('Recipient emails').fill('client@northstar.invalid');
  const createdResponsePromise = page.waitForResponse((response) => response.url() === `${api}/client-reports` && response.request().method() === 'POST');
  const generatedResponsePromise = page.waitForResponse((response) => response.url().endsWith('/generate') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create draft' }).click();
  const createdResponse = await createdResponsePromise;
  expect(createdResponse.status(), await createdResponse.text()).toBe(201);
  const generatedResponse = await generatedResponsePromise;
  expect(generatedResponse.status(), await generatedResponse.text()).toBe(201);
  const reportCard = page.locator('article').filter({ hasText: title });
  await expect(reportCard).toBeVisible();
  await reportCard.getByRole('button', { name: 'Preview exact content' }).click();
  const reportPreview = reportCard.getByRole('region', { name: `Preview for ${title}` });
  await expect(reportPreview.getByText(/Total revenue: 1200 USD/)).toBeVisible();
  await expect(reportPreview.getByText(/ProjectProfitability.totalRevenue/)).toBeVisible();
  await expect(reportPreview.getByText(/Data as of:/)).toBeVisible();

  await reportCard.getByLabel(`Notification consent note for ${title}`).fill('Approved for this fictional client fixture.');
  page.once('dialog', (dialog) => dialog.accept());
  const approvalResponsePromise = page.waitForResponse((response) => response.url().includes('/client-reports/') && response.url().endsWith('/approve') && response.request().method() === 'POST');
  await reportCard.getByRole('button', { name: 'Approve and notify client' }).click();
  const approvalResponse = await approvalResponsePromise;
  expect(approvalResponse.status(), await approvalResponse.text()).toBe(201);
  await expect(reportCard.getByText(/Delivery: sent/)).toBeVisible();
  await expect(reportCard.getByText(/Approved revision 1/)).toBeVisible();

  const reportRows = await page.request.get(`${api}/client-reports/workspace/${workspaceId}`);
  expect(reportRows.status()).toBe(200);
  const report = (await reportRows.json()).data.find((candidate: { title: string }) => candidate.title === title);
  expect(report).toMatchObject({ status: 'SENT', revision: 1, deliveries: [expect.objectContaining({ status: 'SENT', attemptCount: 1 })] });

  const csvResponse = await page.request.get(`${api}/client-reports/${report.id}/revisions/1/csv`);
  expect(csvResponse.status()).toBe(200);
  const csv = await csvResponse.text();
  expect(csv).toContain('"1200","USD","ProjectProfitability.totalRevenue"');
  const pdfResponse = await page.request.get(`${api}/client-reports/${report.id}/revisions/1/pdf`);
  expect(pdfResponse.status()).toBe(200);
  expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe('%PDF');

  const revisionResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/client-reports/${report.id}/revise`) && response.request().method() === 'POST');
  await reportCard.getByRole('button', { name: 'Create revision' }).click();
  expect((await revisionResponsePromise).status()).toBe(201);
  const revise = await page.request.patch(`${api}/client-reports/${report.id}`, {
    headers,
    data: { executiveSummary: 'Human note (unverified): A second fictional report revision.' },
  });
  expect(revise.status()).toBe(200);
  const approveSecond = await page.request.post(`${api}/client-reports/${report.id}/approve`, {
    headers,
    data: { notifyClient: false },
  });
  expect(approveSecond.status()).toBe(201);
  const csvV2 = await page.request.get(`${api}/client-reports/${report.id}/revisions/2/csv`);
  expect(csvV2.status()).toBe(200);
  expect(await csvV2.text()).toContain('"1200","USD","ProjectProfitability.totalRevenue"');

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto('/auth/login');
  await clientPage.getByPlaceholder('you@example.com').fill('client@northstar.invalid');
  await clientPage.getByPlaceholder('••••••••').fill(fixturePassword);
  await clientPage.getByRole('button', { name: /sign in/i }).click();
  await clientPage.goto(`/share/${link.token}`);
  await clientPage.getByRole('button', { name: 'Open portal' }).click();
  const clientReport = clientPage.locator('article').filter({ hasText: title });
  await expect(clientPage.getByRole('heading', { name: 'Delivered reports' })).toBeVisible();
  await expect(clientReport.getByText('revision 1')).toBeVisible();
  const clientRevenueFact = clientReport.getByRole('listitem').filter({ hasText: /Total revenue:/ });
  await expect(clientRevenueFact).toContainText('1200 USD');
  await expect(clientRevenueFact).toContainText('ProjectProfitability.totalRevenue');
  const unauthorizedDownload = await clientPage.request.get(`${api}/client-reports/${report.id}/revisions/1/csv`);
  expect(unauthorizedDownload.status()).toBe(403);
  await clientPage.reload();
  await clientPage.getByRole('button', { name: 'Open portal' }).click();
  await expect(clientPage.locator('article').filter({ hasText: title }).getByRole('listitem').filter({ hasText: /Total revenue:/ })).toContainText('1200 USD');
  await clientContext.close();
});

test("invalid client share shows a recoverable error instead of sample success", async ({
  page,
}) => {
  await page.goto("/v/not-a-valid-share-token");
  await expect(
    page.getByRole("heading", { name: "Client portal unavailable" }),
  ).toBeVisible();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "This client portal is unavailable",
  );
});

test("command center resolves a client blocker from the overview in three clicks", async ({
  page,
}) => {
  await page.goto("/auth/login");
  await page
    .getByPlaceholder("you@example.com")
    .fill("owner@northstar.invalid");
  await page.getByPlaceholder("••••••••").fill(fixturePassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("button", { name: "Create demo client portal" }),
  ).toBeVisible();

  const headers = {
    Origin: "http://127.0.0.1:3001",
    "X-CSRF-Token": "browser-session",
  };
  const created = await page.request.post(`${api}/portals/demo`, { headers });
  expect(created.status()).toBe(201);
  const portalId = (await created.json()).data.portalId as string;
  const updated = await page.request.patch(`${api}/portals/${portalId}`, {
    headers,
    data: {
      clientStatus: "BLOCKED",
      clientStatusNote: "Fictional blocker for command-center smoke.",
      pendingDecision: "Approve the fictional sample plan",
    },
  });
  expect(updated.status()).toBe(200);

  await page.goto("/dashboard");
  const queue = page.getByRole("region", { name: "Client attention" });
  await expect(queue).toContainText("Approve the fictional sample plan");
  const review = queue.locator(`a[href="/dashboard/portals/${portalId}/edit"]`);
  await expect(review).toBeVisible();
  await review.click();
  await page.locator("#client-status").selectOption("COMPLETED");
  await page.locator("#pending-decision").fill("");
  const save = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/portals/${portalId}`) &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save draft" }).click();
  expect((await save).status()).toBe(200);
  await expect(page.getByRole("status")).toContainText("Draft saved");

  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", { name: "Client attention" }),
  ).toContainText("No client blockers or pending decisions.");
});

test("value ledger claim carries evidence into an immutable client packet and export", async ({
  page,
}) => {
  await page.goto("/auth/login");
  await page
    .getByPlaceholder("you@example.com")
    .fill("owner@northstar.invalid");
  await page.getByPlaceholder("••••••••").fill(fixturePassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("button", { name: "Create demo client portal" }),
  ).toBeVisible();

  const portalId = "00000000-0000-4000-8000-000000000032";
  await page.goto("/dashboard/analytics");
  await expect(
    page.getByRole("heading", { name: "Proof-of-value ledger" }),
  ).toBeVisible();
  await page.getByLabel("Value ledger client portal").selectOption(portalId);
  const form = page
    .locator("form")
    .filter({
      has: page.getByRole("heading", { name: "Add a new draft revision" }),
    });
  await form
    .getByLabel("Claim title")
    .fill("Fictional monthly time-saved estimate");
  await form.getByLabel("Period start").fill("2026-10-01");
  await form.getByLabel("Period end").fill("2026-11-01");
  const hoursGroup = form.getByRole("group", {
    name: /Hours saved per period/,
  });
  await hoursGroup.getByLabel("Low").fill("4");
  await hoursGroup.getByLabel("Base").fill("6");
  await hoursGroup.getByLabel("High").fill("8");
  await form
    .getByLabel("Evidence note for hours assumption")
    .fill("Assumption entered for local acceptance testing.");
  const rateGroup = form.getByRole("group", { name: /Loaded hourly rate/ });
  await rateGroup.getByLabel("Low").fill("40");
  await rateGroup.getByLabel("Base").fill("50");
  await rateGroup.getByLabel("High").fill("60");
  await form
    .getByLabel("Evidence note for rate assumption")
    .fill("Fictional client-approved blended rate card.");
  await form.getByRole("button", { name: "Save draft revision" }).click();
  const entry = page
    .locator("article")
    .filter({ hasText: "Fictional monthly time-saved estimate" });
  await expect(entry).toContainText("300 USD");
  await page
    .getByLabel(
      "Include newly approved claims in the next published client packet",
    )
    .check();
  await entry.getByRole("button", { name: "Approve and share" }).click();
  await expect(entry).toContainText("APPROVED · client visible");
  const portalResponse = await page.request.get(`${api}/portals/${portalId}`);
  expect(portalResponse.status()).toBe(200);
  const shareToken = (await portalResponse.json()).data.shareToken as string;
  const publicView = await page.request.get(
    `${api}/portals/share/${shareToken}/view`,
  );
  expect(publicView.status()).toBe(200);
  const publicData = (await publicView.json()).data;
  expect(publicData.valueClaims).toHaveLength(1);
  expect(publicData.valueClaims[0]).toMatchObject({
    formula: "time_saved_cost@1.0.0",
    calculation: "hoursSaved × loadedHourlyRate",
    value: "300",
    enteredBy: "Northstar Owner",
    assumptions: expect.objectContaining({
      hoursSaved: expect.objectContaining({
        evidence: expect.objectContaining({
          owner: "Northstar Owner",
          note: "Assumption entered for local acceptance testing.",
        }),
      }),
    }),
  });
  expect(JSON.stringify(publicData.valueClaims)).not.toMatch(
    /workspaceId|createdById|approvedById|accessToken|password/i,
  );

  const packet = await page.request.get(
    `${api}/exports/portal/${portalId}/value-ledger.json`,
  );
  expect(packet.status()).toBe(200);
  expect(packet.headers()["content-type"]).toContain("application/json");
  const packetData = await packet.json();
  expect(packetData.claims[0]).toMatchObject({
    revision: 1,
    value: "300",
    sensitivity: { low: 160, base: 300, high: 480 },
  });
  expect(packetData.calculationNotes).toHaveLength(3);

  await page.goto(`/v/${shareToken}`);
  await expect(
    page.getByRole("heading", { name: "Proof of value" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fictional monthly time-saved estimate"),
  ).toBeVisible();
  await expect(
    page.getByText(/not proof of causal attribution/i),
  ).toBeVisible();
});

test("product analytics records tenant-scoped costs, usage and experiment exports", async ({ page, browser }) => {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@example.com").fill("owner@northstar.invalid");
  await page.getByPlaceholder("••••••••").fill(fixturePassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("button", { name: "Create demo client portal" })).toBeVisible();

  const headers = { Origin: "http://127.0.0.1:3001", "X-CSRF-Token": "browser-session" };
  const consent = await page.request.patch(`${api}/onboarding/analytics-consent`, {
    headers,
    data: { consented: true },
  });
  expect(consent.status()).toBe(200);
  const eventIds = [
    "00000000-0000-4000-8000-000000000201",
    "00000000-0000-4000-8000-000000000202",
    "00000000-0000-4000-8000-000000000203",
    "00000000-0000-4000-8000-000000000204",
    "00000000-0000-4000-8000-000000000205",
    "00000000-0000-4000-8000-000000000206",
  ];
  const postEvent = (data: Record<string, unknown>) => page.request.post(`${api}/analytics/product-events`, { headers, data });
  const adoption = await postEvent({ eventId: eventIds[0], featureKey: "portal_builder", kind: "FEATURE_ADOPTION", eventName: "opened" });
  expect(adoption.status()).toBe(201);
  const duplicate = await postEvent({ eventId: eventIds[0], featureKey: "portal_builder", kind: "FEATURE_ADOPTION", eventName: "opened" });
  expect((await duplicate.json()).data).toMatchObject({ accepted: false, duplicate: true });
  await postEvent({ eventId: eventIds[1], featureKey: "portal_builder", kind: "FEATURE_SUCCESS", eventName: "published" });
  await postEvent({ eventId: eventIds[2], featureKey: "portal_builder", kind: "FEATURE_GUARDRAIL", eventName: "publish_conflict" });
  await postEvent({
    eventId: eventIds[3], featureKey: "ai_briefings", kind: "COST", eventName: "tokens.used",
    value: 2500, unit: "tokens", costCategory: "AI_TOKENS", costBasis: "ESTIMATED", costMicros: 50000, currency: "USD",
  });
  await postEvent({
    eventId: eventIds[5], featureKey: "portal_builder", kind: "COST", eventName: "job.runtime",
    value: 2, unit: "seconds", costCategory: "JOB_RUNTIME", costBasis: "OBSERVED", costMicros: 5000, currency: "USD",
  });
  await postEvent({
    eventId: eventIds[4], featureKey: "portal_builder", kind: "EXPERIMENT", eventName: "publish_success",
    value: 1, experimentKey: "publish-flow", variantKey: "keyboard",
  });

  await page.goto("/dashboard/analytics");
  const panel = page.getByRole("region", { name: "Feature use and operating cost" });
  await expect(panel).toBeVisible();
  const builderRow = panel.getByRole("row", { name: /portal_builder/ });
  await expect(builderRow.getByRole("cell").nth(0)).toHaveText("1");
  await expect(builderRow.getByRole("cell").nth(1)).toHaveText("1");
  await expect(builderRow.getByRole("cell").nth(2)).toHaveText("1");
  await expect(builderRow.getByRole("cell").nth(3)).toContainText("JOB_RUNTIME 2 seconds");
  await expect(builderRow.getByRole("cell").nth(4)).toContainText("JOB_RUNTIME USD 0.005");
  const aiRow = panel.getByRole("row", { name: /ai_briefings/ });
  await expect(aiRow).toContainText("AI_TOKENS USD 0.05");
  await expect(panel).toContainText("publish-flow · keyboard");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.getByRole("button", { name: "Export experiment results" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("experiment-results.csv");

  const csv = await page.request.get(`${api}/analytics/product-analytics/experiments.csv?days=30`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('"publish-flow","keyboard","publish_success","1"');

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto("/auth/login");
  await clientPage.getByPlaceholder("you@example.com").fill("client@northstar.invalid");
  await clientPage.getByPlaceholder("••••••••").fill(fixturePassword);
  await clientPage.getByRole("button", { name: /sign in/i }).click();
  await expect(clientPage.getByRole("heading", { name: "Agency access required" })).toBeVisible();
  const denied = await clientPage.request.get(`${api}/analytics/product-analytics`);
  expect(denied.status()).toBe(403);
  await clientContext.close();
});
