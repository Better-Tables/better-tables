"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  code: string;
  filename?: string;
  language?: string;
  showLineNumbers?: boolean;
  highlightedLines?: number[];
  className?: string;
}

export function CodeBlock({
  code,
  filename,
  language = "typescript",
  showLineNumbers = true,
  highlightedLines = [],
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    function checkTheme() {
      const html = document.documentElement;
      setIsDark(
        html.classList.contains("dark") || html.style.colorScheme === "dark",
      );
    }

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => observer.disconnect();
  }, []);

  function copyToClipboard() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const baseTheme = isDark ? oneDark : oneLight;
  const syntaxTheme = {
    ...baseTheme,
    'pre[class*="language-"]': {
      ...baseTheme['pre[class*="language-"]'],
      background: "transparent !important",
      margin: 0,
      padding: 0,
    },
    'code[class*="language-"]': {
      ...baseTheme['code[class*="language-"]'],
      background: "transparent !important",
    },
  };

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-background ${className}`}
    >
      {(filename || language) && (
        <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            {filename && <span>{filename}</span>}
            {language && !filename && (
              <span className="text-muted-foreground">{language}</span>
            )}
          </div>
          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <div className="overflow-x-auto [&_pre]:!bg-transparent [&_code]:!bg-transparent">
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{
            minWidth: "3em",
            paddingRight: "1em",
            textAlign: "right",
            userSelect: "none",
            backgroundColor: "transparent",
          }}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "0.875rem",
            lineHeight: "1.625",
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
            userSelect: "text",
          }}
          PreTag="div"
          CodeTag="code"
          lineProps={(lineNumber) => {
            const style: React.CSSProperties = {
              display: "block",
              backgroundColor: "transparent",
            };
            if (highlightedLines.includes(lineNumber)) {
              style.backgroundColor = isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.05)";
            }
            return { style };
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
