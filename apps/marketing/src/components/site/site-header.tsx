'use client';

import { MenuIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icons } from '@/components/icons';
import { CopyChip } from '@/components/site/copy-chip';
import { siteConfig } from '@/lib/config';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/92 backdrop-blur-sm">
      <div className="shell flex h-(--header-height) items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-foreground"
          aria-label="Better Tables home"
        >
          <Icons.logo className="size-[22px] text-ledger" />
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Better Tables
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {siteConfig.nav.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13.5px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <CopyChip
            bare
            command={siteConfig.installCommand}
            className="hidden px-3 py-1.5 text-xs lg:inline-flex"
          />
          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noreferrer"
            aria-label="Better Tables on GitHub"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icons.github className="size-[18px]" />
          </a>
        </div>

        <button
          type="button"
          className="text-foreground md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t bg-background md:hidden">
          <nav aria-label="Mobile" className="shell flex flex-col py-2">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-3 text-[15px] font-medium text-foreground last:border-b-0"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 py-3 text-[15px] font-medium text-foreground"
            >
              <Icons.github className="size-4" /> GitHub
            </a>
            <div className="min-w-0 py-3">
              <CopyChip
                command={siteConfig.installCommand}
                className="w-full max-w-full justify-between"
              />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
