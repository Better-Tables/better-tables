import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Better Tables Demo',
  description: 'Comprehensive demo of Better Tables with Drizzle adapter',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
