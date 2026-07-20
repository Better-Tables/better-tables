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
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
