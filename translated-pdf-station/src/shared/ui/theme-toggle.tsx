/**
 * @file theme-toggle.tsx
 * @description Dropdown menu that lets the user pick light / dark / system.
 *
 * The trigger icon reflects the *preference* (not the resolved scheme),
 * so a user who selected "system" sees the Monitor glyph even though the
 * page is actually rendered dark or light.
 *
 * Built on @radix-ui/react-dropdown-menu for full keyboard, focus-trap,
 * and screen-reader support. Animated with motion/react via AnimatePresence
 * so the menu gets a spring enter and a fast opacity exit.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { useState } from 'react';

// --- Third-party Libraries ---
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// --- Absolute Imports ---
import { useThemeStore, type Theme } from '@/shared/theme';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Constants
// =================================================================================================

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; labelKey: string; fallback: string }[] = [
  { value: 'light', icon: Sun, labelKey: 'theme.light', fallback: 'Light' },
  { value: 'dark', icon: Moon, labelKey: 'theme.dark', fallback: 'Dark' },
  { value: 'system', icon: Monitor, labelKey: 'theme.system', fallback: 'System' },
];

const ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

// =================================================================================================
// Component
// =================================================================================================

function ThemeToggle() {
  const { t } = useTranslation();


  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const Icon = ICONS[theme];
  const action = t('actions.toggleTheme', { defaultValue: 'Theme' });

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={action}
          title={action}
          className="app-nav-action app-dropdown-trigger h-8 w-8"
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>

      <AnimatePresence>
        {open && (
          <DropdownMenu.Portal forceMount>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              asChild
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, scale: 0.95, y: -4 }}
                animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 380, damping: 28 }
                }
                className={cn(
                  'z-50 min-w-[140px] overflow-hidden rounded-lg p-1',
                  'app-dropdown-content',
                  'border-[length:var(--surface-border-width)] border-[var(--color-border)]',
                  'bg-[var(--color-card)]/95 backdrop-blur-lg',
                  'shadow-lg',
                  'origin-[var(--radix-dropdown-menu-content-transform-origin)]'
                )}
              >
                <DropdownMenu.RadioGroup
                  value={theme}
                  onValueChange={(v) => setTheme(v as Theme)}
                >
                  {THEME_OPTIONS.map((opt) => {
                    const OptionIcon = opt.icon;
                    return (
                      <DropdownMenu.RadioItem
                        key={opt.value}
                        value={opt.value}
                        className={cn(
                          'flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                          'app-dropdown-item',
                          'text-[var(--color-foreground)]',
                          'transition-colors duration-100',
                          'data-[highlighted]:bg-[var(--color-primary)]/8',
                          'data-[state=checked]:text-[var(--color-primary)]'
                        )}
                      >
                        <OptionIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span className="flex-1">
                          {t(opt.labelKey, { defaultValue: opt.fallback })}
                        </span>
                        <DropdownMenu.ItemIndicator>
                          <Check aria-hidden="true" className="h-3.5 w-3.5" />
                        </DropdownMenu.ItemIndicator>
                      </DropdownMenu.RadioItem>
                    );
                  })}
                </DropdownMenu.RadioGroup>
              </motion.div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        )}
      </AnimatePresence>
    </DropdownMenu.Root>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ThemeToggle };
