import { ArrowUpRightIcon } from 'lucide-react';
import Link from 'next/link';
import { CodeBlock } from '@/components/site/code-block';
import { CopyChip } from '@/components/site/copy-chip';
import { siteConfig } from '@/lib/config';
import { constructMetadata } from '@/lib/utils';

// This route is reserved for the full fumadocs-powered documentation site.
// Until that lands, it hosts the quickstart and points at the references
// that exist today.

export const metadata = constructMetadata({
  title: 'Docs',
  description: 'Better Tables documentation — quickstart today, full docs in the works.',
});

const DEFINE_SNIPPET = `import { betterTables } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { db } from './db';

export const tables = betterTables({ database: drizzleAdapter(db) });

// Columns inferred from your schema; add a factory to customize.
export const usersTable = tables.define('users');`;

const RENDER_SNIPPET = `// app/users/page.tsx
import { BetterTable } from '@/components/better-tables-ui';
import { tables, usersTable } from '@/lib/tables';

export default async function UsersPage() {
  const result = await tables.fetchData(usersTable, {
    pagination: { page: 1, limit: 10 },
  });

  return (
    <BetterTable
      table={usersTable}
      data={result.data}
      totalCount={result.total}
      features={{ filtering: true, sorting: true, pagination: true }}
    />
  );
}`;

const references = [
  { label: 'Root README', path: '/blob/main/README.md' },
  { label: '@better-tables/core', path: '/blob/main/packages/core/README.md' },
  {
    label: '@better-tables/adapters-drizzle',
    path: '/blob/main/packages/adapters/drizzle/README.md',
  },
  { label: 'CLI', path: '/blob/main/packages/cli/README.md' },
];

export default function DocsPage() {
  return (
    <main className="shell pt-14 pb-20 md:pt-20">
      <div className="max-w-2xl">
        <p className="row-eyebrow">
          <b>wip</b>
          documentation
        </p>
        <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-tight tracking-tight md:text-[3rem]">
          The docs are being written.
        </h1>
        <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
          Full documentation is on its way. Until it lands, the quickstart below and the{' '}
          <Link href="/examples" className="text-ledger underline-offset-4 hover:underline">
            live examples
          </Link>{' '}
          — each with a view-source link — are the best reference.
        </p>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_16rem]">
        <ol className="flex max-w-2xl flex-col gap-10">
          <li>
            <p className="row-eyebrow">
              <b>1</b>
              copy the ui into your repo
            </p>
            <p className="mt-3 mb-4 text-[14px] leading-relaxed text-muted-foreground">
              Requires an existing shadcn/ui setup. The CLI installs{' '}
              <code className="font-mono text-[13px]">@better-tables/core</code> and the Drizzle
              adapter, then copies the table and filter source into your components directory.
            </p>
            <CopyChip command={siteConfig.installCommand} />
          </li>
          <li>
            <p className="row-eyebrow">
              <b>2</b>
              define a table
            </p>
            <p className="mt-3 mb-4 text-[14px] leading-relaxed text-muted-foreground">
              Point the adapter at your Drizzle instance. Columns can be fully inferred from the
              schema, or spelled out with the builder.
            </p>
            <CodeBlock code={DEFINE_SNIPPET} lang="ts" title="lib/tables.ts" />
          </li>
          <li>
            <p className="row-eyebrow">
              <b>3</b>
              render it
            </p>
            <p className="mt-3 mb-4 text-[14px] leading-relaxed text-muted-foreground">
              Fetch on the server, render the component you own. Filtering, sorting, and pagination
              compile to queries against your database.
            </p>
            <CodeBlock code={RENDER_SNIPPET} lang="tsx" title="app/users/page.tsx" />
          </li>
        </ol>

        <aside className="flex flex-col gap-2.5 self-start lg:border-l lg:pl-6">
          <span className="row-eyebrow">references</span>
          {references.map((ref) => (
            <a
              key={ref.label}
              href={`${siteConfig.links.github}${ref.path}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {ref.label} <ArrowUpRightIcon className="size-3" />
            </a>
          ))}
        </aside>
      </div>
    </main>
  );
}
