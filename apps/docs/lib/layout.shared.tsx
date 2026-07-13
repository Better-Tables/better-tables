import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/logo';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-semibold">Better Tables</span>
        </div>
      ),
    },
    links: [
      {
        text: 'Docs',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'GitHub',
        url: 'https://github.com/Better-Tables/better-tables',
        external: true,
      },
    ],
    githubUrl: 'https://github.com/Better-Tables/better-tables',
  };
}
