---
id: add-animate-ui-component
title: Add a new animate-ui primitive
description: Authoring playbook for a new motion-aware UI primitive under src/shared/ui/, including cva variants, accessibility wiring, and tests.
keywords: [ui, component, primitive, animate-ui, motion, design system]
applies_to: ["src/shared/ui/**"]
---

# Skill: add an animate-ui primitive

Use when the user asks to add a reusable UI primitive (Dropdown, Tooltip, Accordion, Switch, etc.). Read [rules/50-ui-axis.md](../../rules/50-ui-axis.md) before starting.

## Step list

1. **Check Radix.** If the primitive has accessibility semantics (menus, dialogs, popovers, tooltips, switches, tabs, accordions, etc.), it MUST be built on the corresponding `@radix-ui/react-*` package. Add the dependency:

   ```bash
   pnpm --filter @eikon/react add @radix-ui/react-<name>
   ```

2. **Create `src/shared/ui/<name>.tsx`:**

   ```tsx
   import * as <Name>Primitive from '@radix-ui/react-<name>';
   import { cva, type VariantProps } from 'class-variance-authority';
   import { motion } from 'motion/react';
   import * as React from 'react';

   import { cn } from '@/shared/lib/cn';

   const <name>Variants = cva(
     'base classes using theme tokens like text-[var(--color-foreground)]',
     {
       variants: { size: { sm: '...', md: '...', lg: '...' } },
       defaultVariants: { size: 'md' },
     }
   );

   export interface <Name>Props
     extends React.ComponentPropsWithoutRef<typeof <Name>Primitive.Root>,
       VariantProps<typeof <name>Variants> {}

   export const <Name> = React.forwardRef<
     React.ElementRef<typeof <Name>Primitive.Root>,
     <Name>Props
   >(({ className, size, ...props }, ref) => (
     <<Name>Primitive.Root
       ref={ref}
       className={cn(<name>Variants({ size }), className)}
       {...props}
     />
   ));
   <Name>.displayName = '<Name>';
   ```

3. **Add motion** only where it improves UX (`AnimatePresence` for enter/exit, `whileTap`/`whileHover` for affordance, `layoutId` for shared layout). Static color/opacity transitions can stay as Tailwind `transition-*` utilities.

4. **Use theme tokens, not raw colors.** `bg-[var(--color-primary)]`, `text-[var(--color-foreground)]`, `border-[var(--color-border)]`. Adding a new token? Edit `src/styles/index.css` under `@theme`.

5. **Export every sub-part the consumer needs.** Mirror the Radix API surface (`<<Name>.Root>`, `<<Name>.Trigger>`, …) by either re-exporting the Radix primitive directly or wrapping each part if you need styles.

6. **Add tests** under `src/shared/ui/__tests__/<name>.test.tsx`:

   - Render the primitive in its default state.
   - Assert at least one ARIA role / label is correct.
   - Assert one variant renders the expected class (smoke-level — don't over-couple to class strings).

7. **Document usage** with a JSDoc on the main export, including a minimal example. If the primitive has non-obvious composition rules, add a short README block at the top of the file.

8. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Completion checklist

- [ ] Lives in `src/shared/ui/<name>.tsx` (single file or a folder if it has many sub-parts).
- [ ] Built on Radix if it has accessibility semantics.
- [ ] Uses theme tokens only; no raw hex / rgb.
- [ ] Variants defined via `cva` when there are 2+ visual modes.
- [ ] Animation, if any, uses `motion/react`.
- [ ] At least one test covers rendering + an ARIA query.
- [ ] No feature-specific knowledge leaks in (the primitive must be feature-agnostic).

## Don't

- Don't install `framer-motion`. Use `motion`.
- Don't bake in feature-specific text or colors.
- Don't add JS-driven hover effects that CSS hover could express.
