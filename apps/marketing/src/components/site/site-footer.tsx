import Link from 'next/link';
import { Icons } from '@/components/icons';
import { siteConfig } from '@/lib/config';

const columns: Array<{
  header: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}> = [
  {
    header: 'site',
    links: [
      { label: 'Examples', href: '/examples' },
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  {
    header: 'packages',
    links: [
      {
        label: '@better-tables/core',
        href: 'https://www.npmjs.com/package/@better-tables/core',
        external: true,
      },
      {
        label: '@better-tables/adapters-drizzle',
        href: 'https://www.npmjs.com/package/@better-tables/adapters-drizzle',
        external: true,
      },
      {
        label: '@better-tables/cli',
        href: 'https://www.npmjs.com/package/@better-tables/cli',
        external: true,
      },
    ],
  },
  {
    header: 'project',
    links: [
      { label: 'GitHub', href: siteConfig.links.github, external: true },
      { label: 'Issues', href: siteConfig.links.issues, external: true },
      { label: 'Contributing', href: siteConfig.links.contributing, external: true },
      { label: 'MIT License', href: siteConfig.links.license, external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="shell grid gap-10 py-12 md:grid-cols-[1.2fr_repeat(3,1fr)] md:gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Icons.logo className="size-[20px] text-ledger" />
            <span className="font-display text-[15px] font-semibold tracking-tight">
              Better Tables
            </span>
          </div>
          <p className="max-w-[26ch] text-[13.5px] leading-relaxed text-muted-foreground">
            {siteConfig.tagline}. Open source, MIT licensed.
          </p>
        </div>

        {columns.map((col) => (
          <nav key={col.header} aria-label={col.header} className="flex flex-col gap-2.5">
            <span className="row-eyebrow">{col.header}</span>
            {col.links.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="w-fit text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        ))}
      </div>

      <div className="border-t">
        <div className="shell flex flex-col justify-between gap-2 py-4 font-mono text-[11px] tracking-wide text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Better Tables · MIT</span>
          <span>Built on shadcn/ui and Drizzle. Every table on this site runs real queries.</span>
        </div>
      </div>
    </footer>
  );
}
