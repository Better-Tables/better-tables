interface SourceFile {
  /** Path shown in the panel header, relative to the repo root. */
  label: string;
  code: string;
}

interface SourceViewProps {
  title?: string;
  files: SourceFile[];
}

/**
 * Collapsible panel showing REAL source code (read at request time by
 * `readSourceFile`, `src/lib/demo/read-source.ts` -- never a hand-pasted
 * copy that can drift from the actual implementation). Plain `<details>`/
 * `<summary>` rather than a component-library accordion: this needs zero
 * client JS and works identically whether the page around it is a Server
 * Component or not.
 */
export function SourceView({ title = 'Source', files }: SourceViewProps) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-[#27272A] bg-[#111217] p-4 md:p-6"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {files.map((file) => (
          <details
            key={file.label}
            className="group rounded-lg border border-[#27272A] bg-[#09090B] open:border-[#60A5FA]/40"
          >
            <summary className="cursor-pointer select-none px-4 py-3 font-mono text-xs text-[#5EEAD4] outline-none">
              {file.label}
            </summary>
            <pre className="overflow-x-auto border-t border-[#27272A] px-4 py-4 text-xs leading-6 text-muted-foreground">
              <code>{file.code}</code>
            </pre>
          </details>
        ))}
      </div>
    </section>
  );
}
