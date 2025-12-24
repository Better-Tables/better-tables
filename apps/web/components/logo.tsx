import Image from 'next/image';
import Link from 'next/link';
import type { ComponentProps } from 'react';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const sizeMap: Record<LogoSize, { width: number; height: number }> = {
  xs: { width: 24, height: 24 },
  sm: { width: 32, height: 32 },
  md: { width: 40, height: 40 },
  lg: { width: 48, height: 48 },
  xl: { width: 64, height: 64 },
  '2xl': { width: 96, height: 96 },
};

interface LogoProps extends Omit<ComponentProps<typeof Image>, 'src' | 'alt' | 'width' | 'height'> {
  size?: LogoSize;
  href?: string;
  className?: string;
}

function mergeClassNames(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Logo({ size = 'md', href, className, ...imageProps }: LogoProps) {
  const dimensions = sizeMap[size];
  const image = (
    <Image
      src="/logo/better-tables-logo.webp"
      alt="Better Tables Logo"
      width={dimensions.width}
      height={dimensions.height}
      className={mergeClassNames('h-auto w-auto', className)}
      priority
      {...imageProps}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {image}
      </Link>
    );
  }

  return image;
}
