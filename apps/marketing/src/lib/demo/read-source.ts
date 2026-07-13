import fs from 'node:fs';
import path from 'node:path';

/**
 * Build-time/request-time read of a REAL source file so the "implementation
 * anatomy" panels on each `/examples/*` page show the ACTUAL current code,
 * not a hand-copied (and driftable) snippet. Server-only (`node:fs`) --
 * every call site is an RSC page component, never a client component.
 *
 * @param relativePath - path relative to the `apps/marketing` package root,
 *   e.g. `'src/lib/demo/support/columns.tsx'`.
 */
export function readSourceFile(relativePath: string): string {
  // NOTE (not a plans/findings/029-dx-findings.md entry -- Next.js/Turbopack
  // build tooling, not a `@better-tables/*` API issue): `next build` prints
  // a non-fatal warning here ("Encountered unexpected file in NFT list ...
  // whole project was traced unintentionally") because `path.join(process.cwd(),
  // relativePath)` with a non-literal second argument looks like a dynamic
  // require to Turbopack's file tracer. Tried the documented
  // `/* turbopackIgnore: true */` pragma at a couple of placements; it did
  // not suppress the warning in this Next.js 16 / Turbopack build (still
  // just a WARNING -- `bun run build --filter=@better-tables/site` succeeds
  // and every page/route generates correctly). Left as a known, harmless
  // build-log warning rather than chasing the exact pragma placement further.
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}
