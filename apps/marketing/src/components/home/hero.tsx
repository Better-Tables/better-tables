import Link from 'next/link';
import { Icons } from '@/components/icons';
import { CopyChip } from '@/components/site/copy-chip';
import { buttonVariants } from '@/components/ui/button';
import { siteConfig } from '@/lib/config';
import { cn } from '@/lib/utils';

export function Hero() {
  return (
    <div className="shell pt-16 pb-12 md:pt-24 md:pb-16">
      <p className="row-eyebrow animate-fade-up">
        <b>00</b>
        open source · mit licensed
      </p>

      <h1
        className="mt-6 max-w-[17ch] font-display text-[2.625rem] leading-[1.04] font-semibold tracking-[-0.03em] text-balance md:text-[4rem] animate-fade-up"
        style={{ animationDelay: '60ms' }}
      >
        Tables that reach your{' '}
        <span className="relative whitespace-nowrap text-ledger">
          database
          <span
            aria-hidden
            className="absolute -right-[3px] top-[0.08em] bottom-[0.08em] w-[3px] bg-ledger animate-caret-blink"
          />
        </span>
      </h1>

      <p
        className="mt-6 max-w-[52ch] text-[15.5px] leading-relaxed text-muted-foreground md:text-[17px] animate-fade-up"
        style={{ animationDelay: '120ms' }}
      >
        A data table is really two problems: the grid your users see, and the queries behind it.
        Most libraries hand you the grid and leave the SQL to you. Better Tables does both — define
        your columns once in TypeScript, and filtering, sorting, pagination, even inline edits
        become real queries against Postgres, MySQL, or SQLite. The UI is source you copy into your
        repo and own.
      </p>

      <div
        className="mt-8 flex flex-wrap items-center gap-3 animate-fade-up"
        style={{ animationDelay: '180ms' }}
      >
        <Link href="/examples" className={cn(buttonVariants({ size: 'lg' }))}>
          Browse the examples
        </Link>
        <a
          href={siteConfig.links.github}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}
        >
          <Icons.github className="size-4" />
          GitHub
        </a>
        <CopyChip command={siteConfig.installCommand} className="hidden sm:inline-flex" />
      </div>
    </div>
  );
}
