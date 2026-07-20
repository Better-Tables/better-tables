import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { siteConfig } from '@/lib/config';
import { gitConfig } from '@/lib/docs';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <span className="font-display font-semibold tracking-tight">{siteConfig.name}</span>,
      url: '/',
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      {
        text: 'Examples',
        url: '/examples',
        active: 'nested-url',
      },
      {
        text: 'Blog',
        url: '/blog',
        active: 'nested-url',
      },
    ],
  };
}
