/**
 * @file breadcrumb.tsx
 * @description Composable breadcrumb trail (shadcn lineage), zero extra
 * dependencies. The root is a labelled `<nav>`, the trail an ordered
 * list, and the current page is marked with `aria-current="page"` so the
 * hierarchy is conveyed to assistive tech.
 *
 * Separators are decorative (`aria-hidden`, `role="presentation"`) — they
 * carry no meaning beyond the visual divide, so they stay out of the a11y
 * tree. `BreadcrumbLink` renders a plain `<a>`; pass `href` or wire it to
 * your router by spreading router-link props.
 *
 * Tokens: links use `--color-muted-foreground` → `--color-foreground` on
 * hover; the current page sits at full `--color-foreground`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Third-party Libraries ---
import { ChevronRight } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Components
// =================================================================================================

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'>
>((props, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />);
Breadcrumb.displayName = 'Breadcrumb';

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<'ol'>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      'flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]',
      className
    )}
    {...props}
  />
));
BreadcrumbList.displayName = 'BreadcrumbList';

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn('inline-flex items-center gap-1.5', className)}
    {...props}
  />
));
BreadcrumbItem.displayName = 'BreadcrumbItem';

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'>
>(({ className, ...props }, ref) => (
  <a
    ref={ref}
    className={cn(
      'rounded-sm transition-colors duration-[var(--duration-fast)] hover:text-[var(--color-foreground)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
BreadcrumbLink.displayName = 'BreadcrumbLink';

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn('font-medium text-[var(--color-foreground)]', className)}
    {...props}
  />
));
BreadcrumbPage.displayName = 'BreadcrumbPage';

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'li'>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:h-3.5 [&>svg]:w-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

// =================================================================================================
// Exports
// =================================================================================================

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
