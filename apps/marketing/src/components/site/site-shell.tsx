'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

/**
 * Marketing chrome wraps every page except `/docs`, which uses the dedicated
 * Fumadocs shell from `app/docs/layout.tsx`.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDocs = pathname === '/docs' || pathname.startsWith('/docs/');

  if (isDocs) {
    return children;
  }

  return (
    <div className="site-frame">
      <SiteHeader />
      {/* `min-w-0` keeps this flex child from growing to its content's
          intrinsic width, so a wide table scrolls inside its own container
          instead of forcing horizontal scroll on the whole page. */}
      <div className="min-w-0 flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
