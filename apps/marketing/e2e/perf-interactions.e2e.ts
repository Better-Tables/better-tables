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
  /** Click → the FIRST DATA ROW's text changed to a new value. */
  domUpdateMs: number;
}

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Click a target (resolved in-page) and measure `domUpdateMs`: click → the
 * FIRST DATA ROW's text changes to a new value.
 *
 * Keying on the first row (not whole-`tbody` text) ties the number to the
 * user-visible RESULT: the loading affordance dims via a CSS class (no text
 * change), so an intermediate mutation during the refetch can't satisfy this
 * the way a coarse whole-container text observer could. An in-page cap rejects
 * if the row never changes, so a broken interaction fails fast rather than
 * wedging the whole test timeout.
 *
 * NOTE: an input-to-next-paint (Event Timing) metric was considered but does
 * not work here — the Event Timing API only records TRUSTED user input, and
 * this harness dispatches a synthetic in-page `element.click()` (needed to
 * anchor `performance.now()` at the exact dispatch). Capturing INP would
 * require driving the click through Playwright's trusted-input path and
 * correlating it back, which is a larger follow-up; the DOM-update latency
 * above is the primary, reliable signal.
 */
async function measureClickToRowsChanged(
  page: Page,
  options: { clickScript: string; rowSelector: string }
): Promise<Sample> {
  return page.evaluate(
    async ({ clickScript, rowSelector }) => {
      const IN_PAGE_TIMEOUT_MS = 8000;
      const firstRowText = () => document.querySelector(rowSelector)?.textContent ?? null;
      const resolveTarget = new Function(`return (${clickScript});`) as () => HTMLElement | null;
      const target = resolveTarget();
      if (!target) throw new Error('click target missing');
      const before = firstRowText();
      if (before === null) throw new Error(`row target missing: ${rowSelector}`);

      const start = performance.now();
      const domUpdateMs = await new Promise<number>((resolve, reject) => {
        let settled = false;
        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          observer.disconnect();
          clearInterval(poll);
          clearTimeout(cap);
          fn();
        };
        const check = () => {
          if (!settled && firstRowText() !== before) {
            const elapsed = performance.now() - start;
            finish(() => resolve(elapsed));
          }
        };
        const observer = new MutationObserver(check);
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
        // Poll as a backstop (a first-row swap that reuses text nodes may not
        // fire a characterData mutation the observer catches).
        const poll = setInterval(check, 16);
        const cap = setTimeout(
          () => finish(() => reject(new Error('rows did not change within cap'))),
          IN_PAGE_TIMEOUT_MS
        );
        // Dispatch the interaction now that the observers/timer are armed.
        target.click();
      });

      return { domUpdateMs };
    },
    { clickScript: options.clickScript, rowSelector: options.rowSelector }
  );
}

async function throttleCpu(page: Page, rate: number): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate });
}

const results: Array<{ name: string; unit: string; value: number; extra?: string }> = [];

function recordSeries(name: string, values: number[]): void {
  if (values.length === 0) return;
  const p50 = percentile(values, 50);
  const p75 = percentile(values, 75);
  results.push({ name: `${name} p50`, unit: 'ms', value: Math.round(p50 * 100) / 100 });
  results.push({
    name: `${name} p75`,
    unit: 'ms',
    value: Math.round(p75 * 100) / 100,
    extra: `n=${values.length} min=${Math.min(...values).toFixed(1)} max=${Math.max(...values).toFixed(1)}`,
  });
  // biome-ignore lint/suspicious/noConsole: perf harness reporter output
  console.log(
    `[perf] ${name}: p50=${p50.toFixed(1)}ms p75=${p75.toFixed(1)}ms ` +
      `min=${Math.min(...values).toFixed(1)} max=${Math.max(...values).toFixed(1)} n=${values.length}`
  );
}

function record(name: string, samples: Sample[]): void {
  recordSeries(
    `${name}.click-to-rows`,
    samples.map((s) => s.domUpdateMs)
  );
}

test.afterAll(() => {
  const outPath = join(__dirname, '..', 'e2e-results', 'perf-interactions.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(results, null, 2)}\n`);
  // biome-ignore lint/suspicious/noConsole: perf harness reporter output
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
    const sample = await measureClickToRowsChanged(page, {
      clickScript: `document.querySelector('[aria-label="${label}"]')`,
      rowSelector: 'tbody tr',
    });
    if (i >= WARMUP) samples.push(sample);
    await page.waitForTimeout(250);
  }
  expect(samples).toHaveLength(REPS - WARMUP);
  record('e2e/pagination', samples);
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
    const sample = await measureClickToRowsChanged(page, {
      clickScript,
      rowSelector: 'tbody tr',
    });
    if (i >= WARMUP) samples.push(sample);
    await page.waitForTimeout(250);
  }
  expect(samples).toHaveLength(REPS - WARMUP);
  record('e2e/sort', samples);
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
    const sample = await measureClickToRowsChanged(page, {
      clickScript,
      rowSelector: 'tbody tr',
    });
    if (i >= WARMUP) samples.push(sample);
    await page.waitForTimeout(250);
  }
  expect(samples).toHaveLength(REPS - WARMUP);
  record('e2e/facet-toggle', samples);
});
