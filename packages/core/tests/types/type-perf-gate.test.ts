import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

/**
 * Plan 063 Step 5 — the type-perf gate, automated.
 *
 * The plan 031/018 fixtures existed for a MANUAL `tsc --extendedDiagnostics`
 * check (budgets recorded in plans/design/table-definition-dx.md: ≤ 2M
 * instantiations, ≤ 2.5 s local check time) that no CI step ever ran. This
 * test runs it on every `bun test` of core:
 *
 * - HARD gate: instantiations ≤ 2,000,000 per fixture — deterministic, the
 *   real budget.
 * - LOOSE gate: check time ≤ 7.5 s (3× the 2.5 s local target) — slow-runner
 *   slack only; wall time never gets a tight CI budget (plan 063 noise
 *   discipline). The measured values are printed so CI logs double as a
 *   trend record (and the bench suite emits them as trend entries).
 *
 * Measurement mode: `tsc -p tests/types/tsconfig.<fixture>.json` — the
 * package's REAL compiler options with only @types/node loaded. A bare
 * `tsc <file>` ignores tsconfig (ES5 default target breaks src imports;
 * every hoisted @types package auto-loads; skipLibCheck is off, so counts
 * drown in stdlib churn). Numbers are therefore NOT comparable to the old
 * manual bare-file measurements.
 *
 * Local fast loops may skip via SKIP_TYPE_PERF=1; in GitHub Actions the
 * skip is ignored so the gate can never silently vanish from CI (same
 * idiom as the drizzle ci-integration-guard).
 */

const inGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const skipRequested = process.env.SKIP_TYPE_PERF === '1' && !inGitHubActions;

const PACKAGE_ROOT = join(import.meta.dir, '..', '..');
const INSTANTIATION_BUDGET = 2_000_000;
const CHECK_TIME_CEILING_S = 7.5;

interface TypePerfMeasurement {
  instantiations: number;
  checkTimeSeconds: number;
}

async function measureFixture(projectRelPath: string): Promise<TypePerfMeasurement> {
  const proc = Bun.spawn(['bunx', 'tsc', '-p', projectRelPath, '--extendedDiagnostics'], {
    cwd: PACKAGE_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`tsc failed (exit ${exitCode}) for ${projectRelPath}:\n${stdout}\n${stderr}`);
  }
  const instantiations = stdout.match(/^Instantiations:\s+([\d,]+)/m);
  const checkTime = stdout.match(/^Check time:\s+([\d.]+)s/m);
  if (!instantiations?.[1] || !checkTime?.[1]) {
    throw new Error(`could not parse extendedDiagnostics output for ${projectRelPath}:\n${stdout}`);
  }
  return {
    instantiations: Number(instantiations[1].replaceAll(',', '')),
    checkTimeSeconds: Number(checkTime[1]),
  };
}

describe.skipIf(skipRequested)('type-perf gate (plan 063 Step 5)', () => {
  const fixtures = [
    { label: 'filter-perf-fixture (plan 031)', project: 'tests/types/tsconfig.filter-perf.json' },
    {
      label: 'table-def-perf-fixture (plan 018)',
      project: 'tests/types/tsconfig.table-def-perf.json',
    },
  ];

  for (const fixture of fixtures) {
    it(`${fixture.label}: ≤ ${INSTANTIATION_BUDGET.toLocaleString()} instantiations (hard), ≤ ${CHECK_TIME_CEILING_S}s check (loose)`, async () => {
      const measured = await measureFixture(fixture.project);
      // biome-ignore lint/suspicious/noConsole: trend record in CI logs
      console.log(
        `[type-perf] ${fixture.label}: instantiations=${measured.instantiations.toLocaleString()} ` +
          `checkTime=${measured.checkTimeSeconds}s (budget ${INSTANTIATION_BUDGET.toLocaleString()} / local target 2.5s)`
      );
      expect(measured.instantiations).toBeGreaterThan(0);
      expect(measured.instantiations).toBeLessThanOrEqual(INSTANTIATION_BUDGET);
      expect(measured.checkTimeSeconds).toBeLessThanOrEqual(CHECK_TIME_CEILING_S);
    }, 60_000);
  }
});
