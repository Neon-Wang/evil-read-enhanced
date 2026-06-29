/**
 * @file accordion.tsx
 * @description Token-driven collapsible panel set (the "Collapse"
 * primitive). Intentionally zero-dependency: rather than pull in
 * `@radix-ui/react-accordion`, it manages open state with a tiny React
 * context and animates height with the modern `grid-template-rows:
 * 0fr → 1fr` technique — no JS height measurement, and it collapses to
 * an instant show/hide under `prefers-reduced-motion`.
 *
 * Composition mirrors the Radix/shadcn shape so it reads familiarly:
 *   <Accordion type="single" defaultValue="a">
 *     <AccordionItem value="a">
 *       <AccordionTrigger>…</AccordionTrigger>
 *       <AccordionContent>…</AccordionContent>
 *     </AccordionItem>
 *   </Accordion>
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Third-party Libraries ---
import { ChevronDown } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Context
// =================================================================================================

interface AccordionContextValue {
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(
  null
);

function useAccordionContext(component: string): AccordionContextValue {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <Accordion>`);
  }
  return ctx;
}

const AccordionItemContext = React.createContext<string | null>(null);

function useItemValue(component: string): string {
  const value = React.useContext(AccordionItemContext);
  if (value == null) {
    throw new Error(`<${component}> must be used inside <AccordionItem>`);
  }
  return value;
}

// =================================================================================================
// Root
// =================================================================================================

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `single` keeps at most one panel open; `multiple` allows many. */
  type?: 'single' | 'multiple';
  /** Initially open value(s). */
  defaultValue?: string | string[];
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ className, type = 'single', defaultValue, children, ...props }, ref) => {
    const [open, setOpen] = React.useState<string[]>(() => {
      if (defaultValue == null) return [];
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    });

    const value = React.useMemo<AccordionContextValue>(
      () => ({
        isOpen: (v) => open.includes(v),
        toggle: (v) =>
          setOpen((prev) => {
            if (prev.includes(v)) return prev.filter((x) => x !== v);
            return type === 'single' ? [v] : [...prev, v];
          }),
      }),
      [open, type]
    );

    return (
      <AccordionContext.Provider value={value}>
        <div
          ref={ref}
          className={cn(
            'divide-y divide-[var(--color-border)] overflow-hidden rounded-md',
            'border-[length:var(--surface-border-width)] border-[var(--color-border)]',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = 'Accordion';

// =================================================================================================
// Item
// =================================================================================================

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, children, ...props }, ref) => (
    <AccordionItemContext.Provider value={value}>
      <div ref={ref} className={cn(className)} {...props}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
);
AccordionItem.displayName = 'AccordionItem';

// =================================================================================================
// Trigger
// =================================================================================================

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen, toggle } = useAccordionContext('AccordionTrigger');
  const value = useItemValue('AccordionTrigger');
  const open = isOpen(value);

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      onClick={() => toggle(value)}
      className={cn(
        'flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium',
        'text-[var(--color-foreground)] transition-colors duration-[var(--duration-fast)]',
        'hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]',
        'focus-visible:outline-none focus-visible:[box-shadow:0_0_0_var(--ring-offset-width)_var(--ring-offset-color),0_0_0_calc(var(--ring-offset-width)_+_var(--ring-width))_var(--color-ring)]',
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          'h-4 w-4 shrink-0 opacity-70 transition-transform duration-[var(--duration-fast)]',
          open && 'rotate-180'
        )}
      />
    </button>
  );
});
AccordionTrigger.displayName = 'AccordionTrigger';

// =================================================================================================
// Content
// =================================================================================================

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen } = useAccordionContext('AccordionContent');
  const value = useItemValue('AccordionContent');
  const open = isOpen(value);

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-[var(--duration-normal)] ease-[var(--ease-out)] motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">
        <div
          ref={ref}
          className={cn(
            'px-4 pb-4 text-sm text-[var(--color-muted-foreground)]',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    </div>
  );
});
AccordionContent.displayName = 'AccordionContent';

// =================================================================================================
// Exports
// =================================================================================================

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
export type { AccordionProps, AccordionItemProps };
