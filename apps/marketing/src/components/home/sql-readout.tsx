import { codeToHtml } from 'shiki';
import { SqlFlash } from '@/components/home/sql-flash';
import { formatSqlForDisplay, splitCapturedQueries } from '@/lib/db/format-sql';
import type { CapturedQuery } from '@/lib/db/sql-capture';

/**
 * The live readout under the demo table: the exact SQL the Drizzle adapter
 * generated for the current filters/sorting/page, re-rendered on the server
 * with every interaction.
 */
export async function SqlReadout({ queries }: { queries: CapturedQuery[] }) {
  const { main, rest } = splitCapturedQueries(queries);
  if (!main) return null;

  const mainSql = formatSqlForDisplay(main);
  const highlight = (sql: string) => codeToHtml(sql, { lang: 'sql', theme: 'everforest-dark' });

  const mainHtml = await highlight(mainSql);
  const restHtml = await Promise.all(rest.map((q) => highlight(formatSqlForDisplay(q))));

  return (
    <SqlFlash signature={mainSql}>
      <div className="code-island">
        <div className="code-island-title">
          <span>generated sql — live from this page&apos;s server</span>
          <span className="hidden sm:inline">@better-tables/adapters-drizzle</span>
        </div>
        <div dangerouslySetInnerHTML={{ __html: mainHtml }} />
        {restHtml.length > 0 && (
          <details className="group border-t border-code-rule">
            <summary className="cursor-pointer list-none px-5 py-2 font-mono text-[11px] tracking-wide text-code-muted transition-colors hover:text-code-foreground">
              <span className="group-open:hidden">
                + {restHtml.length} more statement{restHtml.length > 1 ? 's' : ''} (count query)
              </span>
              <span className="hidden group-open:inline">− collapse</span>
            </summary>
            {restHtml.map((html, i) => (
              <div key={rest[i]?.query ?? i} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
          </details>
        )}
      </div>
      <p className="mt-2 font-mono text-[11px] tracking-wide text-muted-foreground">
        Captured from the drizzle logger during this render. Bound parameters inlined for
        readability.
      </p>
    </SqlFlash>
  );
}
