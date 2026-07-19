import Link from 'next/link';
import { Icons } from '@/components/icons';
import { CopyChip } from '@/components/site/copy-chip';
import { buttonVariants } from '@/components/ui/button';
import { siteConfig } from '@/lib/config';
import { cn } from '@/lib/utils';

export function ClosingCta() {
  return (
    <section className="border-t">
      <div className="shell flex flex-col items-start gap-6 py-16 md:items-center md:py-24 md:text-center">
        <p className="row-eyebrow">
          <b>05</b>
          install
        </p>
        <h2 className="max-w-[16ch] font-display text-[2rem] font-semibold leading-tight tracking-tight text-balance md:text-[2.75rem]">
          Own your tables.
        </h2>
        <p className="max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
          One command copies the table and filter source into your repo — components you edit, not a
          dependency you fight. Requires an existing shadcn/ui setup; the CLI checks, and installs
          any missing primitives.
        </p>
        <CopyChip command={siteConfig.installCommand} className="px-5 py-3 text-[14px]" />
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/docs" className={cn(buttonVariants({ variant: 'outline' }))}>
            Read the docs
          </Link>
          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2')}
          >
            <Icons.github className="size-4" />
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
