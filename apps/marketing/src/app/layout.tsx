import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Schibsted_Grotesk } from 'next/font/google';
import { SiteShell } from '@/components/site/site-shell';
import { TailwindIndicator } from '@/components/tailwind-indicator';
import { cn, constructMetadata } from '@/lib/utils';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
  display: 'swap',
});

export const metadata: Metadata = constructMetadata();

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f4f4f0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} ${schibsted.variable}`}
    >
      <body className={cn('flex min-h-screen flex-col bg-background antialiased font-sans')}>
        <RootProvider
          theme={{
            attribute: 'class',
            defaultTheme: 'light',
            enableSystem: false,
          }}
        >
          <SiteShell>{children}</SiteShell>
          <TailwindIndicator />
        </RootProvider>
      </body>
    </html>
  );
}
