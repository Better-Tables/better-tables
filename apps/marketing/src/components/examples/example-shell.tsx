import { ArrowLeftIcon, ArrowUpRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { siteConfig } from '@/lib/config';

interface ExampleShellProps {
  /** Position in the examples set, e.g. "01". */
  index: string;
  total?: string;
  label: string;
  title: ReactNode;
  lede: ReactNode;
  /** Repo-relative path under apps/marketing, e.g. "src/app/(marketing)/examples/facets". */
  sourcePath: string;
  /** Short mono facts shown under the lede, e.g. "20 tickets · 3 tables". */
  facts?: string[];
  children: ReactNode;
}

/** Shared page chrome for the live example pages. */
export function ExampleShell({
  index,
  total = '04',
  label,
  title,
  lede,
  sourcePath,
  facts = [],
  children,
}: ExampleShellProps) {
  return (
    <div className="shell pt-10 pb-20">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/examples"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3" />
          all examples
        </Link>
        <p className="row-eyebrow">
          <b>{index}</b>
          <span>
            / {total} — {label}
          </span>
        </p>
      </div>

      <div className="mt-8 mb-10 max-w-3xl">
        <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight md:text-[2.625rem]">
          {title}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground md:text-[16px]">
          {lede}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11.5px] tracking-wide text-muted-foreground">
          {facts.map((fact) => (
            <span key={fact} className="tnum rounded-full border border-border px-2.5 py-1">
              {fact}
            </span>
          ))}
          <a
            href={`${siteConfig.sourceBase}/${sourcePath}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-ledger transition-colors hover:text-ledger-strong"
          >
            view source <ArrowUpRightIcon className="size-3" />
          </a>
        </div>
      </div>

      {children}
    </div>
  );
}
