import { codeToHtml } from 'shiki';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  lang: 'tsx' | 'ts' | 'sql' | 'bash' | 'json';
  /** Filename or context label shown in the island's title bar. */
  title?: string;
  /** Right-aligned annotation in the title bar. */
  badge?: string;
  className?: string;
}

/** Server-rendered shiki code block inside a dark code island. */
export async function CodeBlock({ code, lang, title, badge, className }: CodeBlockProps) {
  const html = await codeToHtml(code.trim(), {
    lang,
    theme: 'everforest-dark',
  });

  return (
    <div className={cn('code-island', className)}>
      {(title || badge) && (
        <div className="code-island-title">
          <span>{title}</span>
          {badge && <span>{badge}</span>}
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
