/**
 * @fileoverview CI guard — the Postgres/MySQL integration suites must actually run.
 *
 * The MySQL and Postgres integration suites gate themselves on
 * `MYSQL_TEST_URL` / `POSTGRES_TEST_URL` via `describe.skipIf(!process.env.…)`.
 * That is correct for local development (SQLite needs no server), but it means
 * that if those env vars are ever unset IN CI — a refactor of the workflow, a
 * removed service container, a renamed secret — the suites skip SILENTLY and
 * the adapter job still reports green. A Postgres- or MySQL-only regression
 * (exactly the class of bug that shipped in #97's history) would then reach
 * main with no failing check.
 *
 * This guard fails the adapter test job when the integration databases are not
 * configured, so "the integration tests didn't run" can never masquerade as
 * "the integration tests passed".
 *
 * Scope:
 * - Runs ONLY inside GitHub Actions (`GITHUB_ACTIONS === 'true'`). Gating on
 *   that specific signal rather than the generic `CI` avoids a false failure
 *   if some local tool sets `CI=1`; developers running the SQLite-only subset
 *   never see it.
 * - Lives in the drizzle package's tests, so it executes only in the
 *   `test-adapters` job — the only CI job whose `bun test` runs this package.
 *   The core / cli / ui / marketing jobs never load it.
 *
 * If the workflow intentionally stops providing a database, delete this file in
 * the same change — do not let it rot into a skipped test.
 */

import { describe, expect, it } from 'bun:test';

const inGitHubActions = process.env.GITHUB_ACTIONS === 'true';

describe.skipIf(!inGitHubActions)('CI integration-database guard', () => {
  it('POSTGRES_TEST_URL is set so the Postgres integration suite runs (not silently skipped)', () => {
    expect(process.env.POSTGRES_TEST_URL?.trim()).toBeTruthy();
  });

  it('MYSQL_TEST_URL is set so the MySQL integration suite runs (not silently skipped)', () => {
    expect(process.env.MYSQL_TEST_URL?.trim()).toBeTruthy();
  });
});
