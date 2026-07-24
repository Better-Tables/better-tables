/**
 * Server-boot warmup for the demo databases (Next.js instrumentation hook).
 *
 * Both demo backends are lazy in-memory SQLite singletons seeded on first
 * use — 5,000 users (+ profiles/posts) for the homepage and 12,000+ tickets
 * for the examples. Without this hook the FIRST visitor's request paid the
 * whole seed inline before getting a response. Kick both initializations at
 * server start instead; concurrent early requests share the same memoized
 * init promise, so the worst case becomes "seed still finishing", never
 * "seed not started".
 *
 * Fire-and-forget on purpose: seeding must not delay server readiness, and
 * a warmup failure is non-fatal — the first real read retries and surfaces
 * the error through the normal path. `next build` never runs this (register
 * fires on server start, not at build), so native-driver setup stays out of
 * build-time page-data collection.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const warm = async () => {
    const [users, support] = await Promise.all([
      import('@/lib/demo/users/adapter'),
      import('@/lib/demo/support/db'),
    ]);
    await Promise.all([users.getTables(), support.getSupportTables()]);
  };

  void warm().catch((error) => {
    // biome-ignore lint/suspicious/noConsole: server-side demo bootstrap diagnostic
    console.warn(
      '[instrumentation] demo database warmup failed (first request will retry):',
      error instanceof Error ? error.message : error
    );
  });
}
