import { expect, test } from '@playwright/test';

const apiBase = 'http://127.0.0.1:3000/api/v1';

function fictionalPortal(token: string) {
  return {
    success: true,
    data: {
      id: `fixture-${token}`,
      name: `Fictional Chaos Portal ${token}`,
      description: 'Synthetic local QA response; not live customer data.',
      workspaceName: 'Northstar Fictional Agency',
      primaryColor: '#123456',
      widgets: [],
      metrics: [],
      valueClaims: [],
      viewMode: 'published',
      publishRevision: 1,
      clientStatus: null,
      clientStatusNote: null,
      latestDeliverable: null,
      pendingDecision: null,
      clientUpdateAt: null,
      feedStatus: {
        health: 'NO_DATA',
        lastSyncedAt: null,
        lastValidDataAt: null,
        sourceCount: 0,
      },
    },
  };
}

test('chaos: client portal shows a recoverable error after 503 and recovers on delayed retry', async ({ page }, testInfo) => {
  const token = 'fixture-outage-recovery';
  const outcomes: Array<{ attempt: number; status: number; durationMs: number }> = [];
  let releaseRetry!: () => void;
  const retryGate = new Promise<void>((resolve) => {
    releaseRetry = resolve;
  });
  let attempt = 0;

  await page.route(`${apiBase}/portals/share/${token}/view`, async (route) => {
    attempt += 1;
    const startedAt = Date.now();
    if (attempt === 1) {
      outcomes.push({ attempt, status: 503, durationMs: Date.now() - startedAt });
      await route.fulfill({ status: 503, json: { message: 'Synthetic upstream outage' } });
      return;
    }
    await retryGate;
    outcomes.push({ attempt, status: 200, durationMs: Date.now() - startedAt });
    await route.fulfill({ status: 200, json: fictionalPortal(token) });
  });

  await test.step('Fixture: synthetic public portal endpoint returns 503; expect unavailable message and Retry control', async () => {
    await page.goto(`/v/${token}`);
    await expect(page.getByRole('heading', { name: 'Client portal unavailable' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('This client portal is unavailable');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  await test.step('Fixture: same endpoint stalls during retry, then returns fictional portal; expect loading then recovered empty KPI state', async () => {
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    releaseRetry();
    await expect(page.getByRole('heading', { name: `Fictional Chaos Portal ${token}` })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Client KPI metrics' })).toContainText(
      'No canonical client metrics have been shared for this portal.',
    );
  });

  await testInfo.attach('chaos-outcomes.json', {
    body: JSON.stringify({ fixture: token, outcomes }, null, 2),
    contentType: 'application/json',
  });
  expect(outcomes).toMatchObject([{ attempt: 1, status: 503 }, { attempt: 2, status: 200 }]);
});

test('chaos: parallel public portal loads isolate overload and success outcomes', async ({ browser }, testInfo) => {
  const fixtureCount = 12;
  const outcomes: Array<{ fixture: string; status: number; durationMs: number }> = [];
  const context = await browser.newContext();
  const pages = await Promise.all(Array.from({ length: fixtureCount }, () => context.newPage()));

  try {
    await Promise.all(pages.map(async (page, index) => {
      const token = `fixture-parallel-${index}`;
      const expectedStatus = index % 2 === 0 ? 200 : 429;
      await page.route(`${apiBase}/portals/share/${token}/view`, async (route) => {
        // Small deterministic jitter stresses concurrent rendering without load against external services.
        const startedAt = Date.now();
        await new Promise((resolve) => setTimeout(resolve, (index % 4) * 20));
        outcomes.push({ fixture: token, status: expectedStatus, durationMs: Date.now() - startedAt });
        if (expectedStatus === 429) {
          await route.fulfill({ status: 429, json: { message: 'Synthetic local overload' } });
          return;
        }
        await route.fulfill({ status: 200, json: fictionalPortal(token) });
      });
      await page.goto(`/v/${token}`);
    }));

    await test.step('Fixtures: six synthetic 200s and six synthetic 429s under 12 parallel page loads; expect per-page content or visible unavailable state with no cross-page data', async () => {
      await Promise.all(pages.map(async (page, index) => {
        const token = `fixture-parallel-${index}`;
        if (index % 2 === 0) {
          await expect(page.locator('h1')).toHaveText(`Fictional Chaos Portal ${token}`);
        } else {
          await expect(page.locator('h1')).toHaveText('Client portal unavailable');
          await expect(page.getByRole('alert')).toContainText('This client portal is unavailable');
        }
      }));
    });
  } finally {
    await context.close();
  }

  outcomes.sort((left, right) => left.fixture.localeCompare(right.fixture));
  const durations = outcomes.map(({ durationMs }) => durationMs).sort((left, right) => left - right);
  await testInfo.attach('chaos-outcomes.json', {
    body: JSON.stringify({
      fixtureCount,
      outcomes,
      metrics: {
        successCount: outcomes.filter(({ status }) => status === 200).length,
        overloadCount: outcomes.filter(({ status }) => status === 429).length,
        p95FixtureDelayMs: durations[Math.ceil(durations.length * 0.95) - 1],
      },
    }, null, 2),
    contentType: 'application/json',
  });
  expect(outcomes).toHaveLength(fixtureCount);
  expect(outcomes.filter(({ status }) => status === 200)).toHaveLength(6);
  expect(outcomes.filter(({ status }) => status === 429)).toHaveLength(6);
});

test('chaos: local API liveness handles a bounded parallel read burst without data writes', async ({ page }, testInfo) => {
  const requestCount = Number(process.env.CHAOS_REQUEST_COUNT || 100);
  if (!Number.isInteger(requestCount) || requestCount < 1 || requestCount > 1000) {
    throw new Error('CHAOS_REQUEST_COUNT must be an integer from 1 through 1000.');
  }

  const outcomes = await Promise.all(Array.from({ length: requestCount }, async () => {
    const startedAt = Date.now();
    const response = await page.request.get(`${apiBase}/health/live`);
    return { status: response.status(), durationMs: Date.now() - startedAt };
  }));
  const durations = outcomes.map(({ durationMs }) => durationMs).sort((left, right) => left - right);
  const acceptableStatuses = outcomes.every(({ status }) => status === 200 || status === 429 || status === 503);
  const successCount = outcomes.filter(({ status }) => status === 200).length;
  const p95Ms = durations[Math.ceil(durations.length * 0.95) - 1];

  await test.step(`Fixture: ${requestCount} concurrent loopback GET /health/live requests; expect bounded 200/429/503 responses, at least one healthy response, and p95 below 10 seconds`, async () => {
    expect(acceptableStatuses).toBe(true);
    expect(successCount).toBeGreaterThan(0);
    expect(p95Ms).toBeLessThan(10_000);
  });

  await testInfo.attach('chaos-load-metrics.json', {
    body: JSON.stringify({
      endpoint: '/api/v1/health/live',
      method: 'GET',
      requestCount,
      successCount,
        rateLimitedCount: outcomes.filter(({ status }) => status === 429).length,
        unavailableCount: outcomes.filter(({ status }) => status === 503).length,
        degradedCount: outcomes.filter(({ status }) => status === 429 || status === 503).length,
      p95ResponseMs: p95Ms,
    }, null, 2),
    contentType: 'application/json',
  });
});
