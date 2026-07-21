import { describe, expect, it } from 'bun:test';

/**
 * CI guard: the MySQL and PostgreSQL integration suites gate on
 * `describe.skipIf(!process.env.MYSQL_TEST_URL)` /
 * `!process.env.POSTGRES_TEST_URL`. That is exactly right for local runs
 * (no DB → skip), but it means a broken CI env wiring would make the entire
 * integration suite silently skip while the job still reports green.
 *
 * These assertions run ONLY in CI (`process.env.CI` is set by GitHub Actions
 * and the workflow's `test-adapters` step). They turn a silent skip of the
 * containerized pg/mysql coverage into a loud, actionable failure. Locally
 * (no `CI`) the whole block is skipped, so contributors without databases are
 * unaffected.
 *
 * If a future CI lane deliberately runs the adapter tests without databases,
 * update this guard rather than deleting it — the point is that "no DB in CI"
 * must be a conscious choice, never an accident.
 */
describe.skipIf(!process.env.CI)('CI database integration coverage', () => {
  it('has MYSQL_TEST_URL set so the MySQL integration suite runs', () => {
    expect(
      process.env.MYSQL_TEST_URL,
      'MYSQL_TEST_URL is unset in CI — the MySQL integration suite would silently skip. Check the mysql service container and env wiring in .github/workflows/test.yml.'
    ).toBeTruthy();
  });

  it('has POSTGRES_TEST_URL set so the PostgreSQL integration suite runs', () => {
    expect(
      process.env.POSTGRES_TEST_URL,
      'POSTGRES_TEST_URL is unset in CI — the PostgreSQL integration suite would silently skip. Check the postgres service container and env wiring in .github/workflows/test.yml.'
    ).toBeTruthy();
  });
});
