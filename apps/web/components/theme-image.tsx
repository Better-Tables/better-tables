"use client";

import Image from "next/image";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";

interface ThemeImageProps
  extends Omit<ComponentProps<typeof Image>, "src" | "alt"> {
  lightSrc: string;
  darkSrc: string;
  alt: string;
  className?: string;
}

export function ThemeImage({
  lightSrc,
  darkSrc,
  alt,
  className,
  ...imageProps
}: ThemeImageProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    // Return light image during SSR to prevent hydration mismatch
    return (
      <Image src={lightSrc} alt={alt} className={className} {...imageProps} />
    );
  }

  return (
    <Image
      src={isDark ? darkSrc : lightSrc}
      alt={alt}
      className={className}
      {...imageProps}
    />
  );
}
