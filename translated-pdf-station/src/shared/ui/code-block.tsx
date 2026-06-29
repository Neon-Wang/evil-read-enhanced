/**
 * @file code-block.tsx
 * @description Token-driven code block (the "CodeBlock" primitive). A
 * chrome bar carries the language label + a copy-to-clipboard button;
 * the body is a horizontally-scrollable monospace `<pre>`. Deliberately
 * dependency-free — no syntax-highlighting engine (shiki/prism would be
 * a heavy chunk for a starter template), just clean, readable, tokenised
 * surface chrome that adapts to every design preset.
 *
 * Surface tokens: `--color-muted` (chrome bar), `--color-card` (body),
 * `--color-border`, `--color-muted-foreground`. Copy state is local and
 * auto-resets after ~1.5s.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Third-party Libraries ---
import { Check, Copy } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Types
// =================================================================================================

interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The code to render and copy. */
  code: string;
  /** Optional language label shown in the chrome bar. */
  language?: string;
  /** Accessible label for the copy button. */
  copyLabel?: string;
}

// =================================================================================================
// Component
// =================================================================================================

const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
  ({ className, code, language, copyLabel = 'Copy code', ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const onCopy = React.useCallback(() => {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return;
      void navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      });
    }, [code]);

    return (
      <div
        ref={ref}
        className={cn(
          'overflow-hidden rounded-md',
          'border-[length:var(--surface-border-width)] border-[var(--color-border)]',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1.5">
          <span className="font-mono text-xs font-medium text-[var(--color-muted-foreground)]">
            {language ?? 'code'}
          </span>
          <button
            type="button"
            onClick={onCopy}
            aria-label={copyLabel}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs',
              'text-[var(--color-muted-foreground)] transition-colors duration-[var(--duration-fast)]',
              'hover:text-[var(--color-foreground)]',
              'focus-visible:outline-none focus-visible:[box-shadow:0_0_0_var(--ring-offset-width)_var(--ring-offset-color),0_0_0_calc(var(--ring-offset-width)_+_var(--ring-width))_var(--color-ring)]'
            )}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <pre className="overflow-x-auto bg-[var(--color-card)] p-3 text-[var(--color-foreground)]">
          <code className="font-mono text-xs leading-relaxed">{code}</code>
        </pre>
      </div>
    );
  }
);

CodeBlock.displayName = 'CodeBlock';

// =================================================================================================
// Exports
// =================================================================================================

export { CodeBlock };
export type { CodeBlockProps };
