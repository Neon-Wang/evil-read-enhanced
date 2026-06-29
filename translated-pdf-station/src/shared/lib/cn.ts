/**
 * @file cn.ts
 * @description Tailwind-aware class name composer.
 *
 * Wraps clsx + tailwind-merge so callers get conditional class lists
 * AND deduplication of conflicting Tailwind utilities (`px-2 px-4`
 * collapses to `px-4`). Prefer this over raw string concatenation
 * whenever conditional classes are involved.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// =================================================================================================
// Helpers
// =================================================================================================

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// =================================================================================================
// Exports
// =================================================================================================

export { cn };
