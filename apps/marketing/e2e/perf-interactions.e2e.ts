import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/**
 * Plan 063 Step 6 — interaction-latency baselines over the production demo.
 *
 * Measures the three server-affecting interaction classes the lag reports
 * were about, each as click → rows-visibly-updated wall time, computed
 * ENTIRELY in-page (performance.now + MutationObserver) so protocol
 * overhead never pollutes the numbers:
 *
 *   1. pagination click (homepage Next/Previous)
 *   2. sort header click (homepage)
 *   3. facet filter toggle (facets example sidebar — the "adding a filter"
 *      path; the in-table filter-dropdown flow is intentionally not
 *      automated here: its portal/popover choreography makes selectors
 *      brittle, and the sidebar toggle exercises the same
 *      filter-change → RSC → batched-facet pipeline)
 *
 * Method: CDP CPU throttling 4x, REPS samples per interaction after WARMUP
 * discarded warm-ups, p50/p75 reported. NO budgets are asserted — this
 * harness asserts mechanics only (rows changed, sample counts) and writes
 * baselines to e2e-results/perf-interactions.json in
 * `customSmallerIsBetter` shape for trend tracking. Budgets get chosen
 * once baseline variance is known (plan 063 Step 7 note).
 */

const REPS = 15;
const WARMUP = 3;

interface Sample {
  ms: number;
}

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Click `clickTarget` (resolved in-page) and resolve with the elapsed ms
 * until the observed container's text content changes. Rejects (via test
 * timeout) if nothing changes — a rows-never-updated regression fails the
 * mechanics assertion, not just the numbers.
 */
async function measureClickToRowsChanged(
  page: Page,
  options: { clickScript: string; observeSelector: string }
): Promise<number> {
  return page.evaluate(
    async ({ clickScript, observeSelector }) => {
      const container = document.querySelector(observeSelector);
      if (!container) throw new Error(`observe target missing: ${observeSelector}`);
      // Indirect eval resolves the click target lazily, at dispatch time.
      const resolveTarget = new Function(`return (${clickScript});`) as () => HTMLElement | null;
      const target = resolveTarget();
      if (!target) throw new Error('click target missing');

      const before = container.textContent;
      const start = performance.now();
      const done = new Promise<number>((resolve) => {
        const observer = new MutationObserver(() => {
          if (container.textContent !== before) {
            observer.disconnect();
            resolve(performance.now() - start);
          }
        });
        observer.observe(container, { subtree: true, childList: true, characterData: true });
      });
      target.click();
      return done;
    },
    { clickScript: options.clickScript, observeSelector: options.observeSelector }
  );
}

async function throttleCpu(page: Page, rate: number): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate });
}

const results: Array<{ name: string; unit: string; value: number; extra?: string }> = [];

function record(name: string, samples: Sample[]): void {
  const values = samples.map((sample) => sample.ms);
  const p50 = percentile(values, 50);
  const p75 = percentile(values, 75);
  results.push({ name: `${name} p50`, unit: 'ms', value: Math.round(p50 * 100) / 100 });
  results.push({
    name: `${name} p75`,
    unit: 'ms',
    value: Math.round(p75 * 100) / 100,
    extra: `n=${values.length} min=${Math.min(...values).toFixed(1)} max=${Math.max(...values).toFixed(1)}`,
  });
  // eslint-disable-next-line no-console
  console.log(
    `[perf] ${name}: p50=${p50.toFixed(1)}ms p75=${p75.toFixed(1)}ms ` +
      `min=${Math.min(...values).toFixed(1)} max=${Math.max(...values).toFixed(1)} n=${values.length}`
  );
}

test.afterAll(() => {
  const outPath = join(__dirname, '..', 'e2e-results', 'perf-interactions.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(results, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`[perf] wrote ${outPath}`);
});

test('homepage pagination click latency', async ({ page }) => {
  await page.goto('/');
  const next = page.getByLabel('Next page');
  await expect(next).toBeEnabled({ timeout: 60_000 });
  await throttleCpu(page, 4);

  const samples: Sample[] = [];
  for (let i = 0; i < REPS; i++) {
    // Alternate Next/Previous so state stays bounded; both are pagination
    // clicks and count as samples.
    const label = i % 2 === 0 ? 'Next page' : 'Previous page';
    const ms = await measureClickToRowsChanged(page, {
      clickScript: `document.querySelector('[aria-label="${label}"]')`,
      observeSelector: 'tbody',
    });
    if (i >= WARMUP) samples.push({ ms });
    await page.waitForTimeout(50);
  }
  expect(samples).toHaveLength(REPS - WARMUP);
  record('e2e/pagination.click-to-rows', samples);
});

test('homepage sort header click latency', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Next page')).toBeEnabled({ timeout: 60_000 });
  await throttleCpu(page, 4);

  // Sortable headers are <th> elements carrying the sort click handler
  // (not buttons) — target the th whose text is the column's display name.
  const clickScript = `[...document.querySelectorAll('thead th')].find((th) => (th.textContent || '').includes('Name'))`;
  const samples: Sample[] = [];
  for (let i = 0; i < REPS; i++) {
    const ms = await measureClickToRowsChanged(page, {
      clickScript,
      observeSelector: 'tbody',
    });
    if (i >= WARMUP) samples.push({ ms });
    await page.waitForTimeout(50);
  }
  expect(samples).toHaveLength(REPS - WARMUP);
  record('e2e/sort.click-to-rows', samples);
});

test('facets sidebar filter toggle latency', async ({ page }) => {
  await page.goto('/examples/facets');
  const sidebar = page.getByLabel('Facet sidebar');
  await expect(sidebar.locator('button').first()).toBeVisible({ timeout: 60_000 });
  // Rows present before we measure.
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 60_000 });
  await throttleCpu(page, 4);

  const clickScript = `document.querySelector('aside[aria-label="Facet sidebar"] button')`;
  const samples: Sample[] = [];
  for (let i = 0; i < REPS; i++) {
    // Each click toggles the same facet value on/off — add and remove are
    // both filter-change interactions.
    const ms = await measureClickToRowsChanged(page, {
      clickScript,
      observeSelector: 'tbody',
    });
    if (i >= WARMUP) samples.push({ ms });
    await page.waitForTimeout(100);
  }
  expect(samples).toHaveLength(REPS - WARMUP);
  record('e2e/facet-toggle.click-to-rows', samples);
});
