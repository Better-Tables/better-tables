import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionRowProps {
  /** Row number in the page-as-table, e.g. "02". */
  index: string;
  /** Mono eyebrow label, e.g. "examples". */
  label: string;
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot on the eyebrow line (links, meta). */
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * A page section styled as one row of the site's table: a full-width top
 * rule, a numbered mono eyebrow, then content.
 */
export function SectionRow({
  index,
  label,
  id,
  title,
  description,
  aside,
  children,
  className,
}: SectionRowProps) {
  const titleId = title ? `${id ?? `section-${index}`}-title` : undefined;

  return (
    <section
      id={id}
      {...(titleId ? { 'aria-labelledby': titleId } : {})}
      className={cn('border-t', className)}
    >
      <div className="shell py-14 md:py-20">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <p className="row-eyebrow">
            <b>{index}</b>
            {label}
          </p>
          {aside}
        </div>

        {(title || description) && (
          <div className="mb-10 max-w-2xl">
            {title && (
              <h2
                id={titleId}
                className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight md:text-[2.125rem]"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}
