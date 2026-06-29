/**
 * @file CommandShowcasePage.tsx
 * @description Route-level component for `/examples/command`.
 *
 * Two surfaces:
 *
 *   - Inline `<Command>` — a static command list rendered directly on
 *     the page (no Dialog), good for in-page settings menus and
 *     contextual menus.
 *   - `<CommandDialog>` — the classic ⌘K palette: keyboard-bound,
 *     opens in our animated Dialog, dismisses on item-select.
 *
 * Wiring intentionally calls `toast.success()` instead of mutating
 * real state so the demo is side-effect-free and the same handler
 * shape works in screenshots / e2e.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import {
  CheckSquare,
  CircleHelp,
  FileText,
  Home,
  LogOut,
  Plus,
  Search,
  Settings,
} from 'lucide-react';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/shared/ui/command';
import { toast } from '@/shared/ui/toaster';

// --- Relative Imports ---
import { ShowcasePageHeader } from '../components/ShowcasePageHeader';
import { ShowcaseSection } from '../components/ShowcaseSection';

// =================================================================================================
// Component
// =================================================================================================

function CommandShowcasePage() {
  const { t } = useTranslation('examples');


  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // ⌘K / Ctrl+K opens the palette from anywhere on the page.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const runCommand = (labelKey: string) => {
    setPaletteOpen(false);
    toast.success(
      t('pages.command.ranToast', { label: t(labelKey) })
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <ShowcasePageHeader
        showBack
        title={t('pages.command.title')}
        subtitle={t('pages.command.description')}
      />

      <main className="flex flex-col gap-12">
        <ShowcaseSection
          anchor="command-palette"
          eyebrow={t('toc.modals')}
          title={t('pages.command.title')}
          description={t('pages.command.shortcutHint')}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setPaletteOpen(true)}>
                {t('pages.command.openLabel')}
              </Button>
              <kbd className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[var(--color-muted-foreground)]">
                ⌘K
              </kbd>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {t('pages.command.shortcutHint')}
              </span>
            </div>

            <CommandDialog
              open={paletteOpen}
              onOpenChange={setPaletteOpen}
              title={t('pages.command.title')}
              description={t('pages.command.shortcutHint')}
            >
              <CommandInput
                placeholder={t('pages.command.placeholder')}
              />
              <CommandList>
                <CommandEmpty>{t('pages.command.empty')}</CommandEmpty>

                <CommandGroup heading={t('pages.command.groups.suggestions')}>
                  <CommandItem
                    onSelect={() => runCommand('pages.command.items.newTask')}
                  >
                    <Plus />
                    <span>{t('pages.command.items.newTask')}</span>
                    <CommandShortcut>
                      {t('pages.command.shortcuts.newTask')}
                    </CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() =>
                      runCommand('pages.command.items.openSettings')
                    }
                  >
                    <Settings />
                    <span>{t('pages.command.items.openSettings')}</span>
                    <CommandShortcut>
                      {t('pages.command.shortcuts.openSettings')}
                    </CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => runCommand('pages.command.items.search')}
                  >
                    <Search />
                    <span>{t('pages.command.items.search')}</span>
                    <CommandShortcut>
                      {t('pages.command.shortcuts.search')}
                    </CommandShortcut>
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading={t('pages.command.groups.navigation')}>
                  <CommandItem
                    onSelect={() => runCommand('pages.command.items.home')}
                  >
                    <Home />
                    <span>{t('pages.command.items.home')}</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => runCommand('pages.command.items.counter')}
                  >
                    <FileText />
                    <span>{t('pages.command.items.counter')}</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => runCommand('pages.command.items.tasks')}
                  >
                    <CheckSquare />
                    <span>{t('pages.command.items.tasks')}</span>
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading={t('pages.command.groups.actions')}>
                  <CommandItem
                    onSelect={() => runCommand('pages.command.items.signOut')}
                  >
                    <LogOut />
                    <span>{t('pages.command.items.signOut')}</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </CommandDialog>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          anchor="command-inline"
          eyebrow={t('pages.command.groups.suggestions')}
          title={t('pages.command.title')}
          description={t('pages.command.description')}
        >
          <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)]">
            <Command className="rounded-md">
              <CommandInput
                placeholder={t('pages.command.placeholder')}
              />
              <CommandList>
                <CommandEmpty>{t('pages.command.empty')}</CommandEmpty>
                <CommandGroup heading={t('pages.command.groups.navigation')}>
                  <CommandItem
                    onSelect={() => runCommand('pages.command.items.home')}
                  >
                    <Home />
                    <span>{t('pages.command.items.home')}</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => runCommand('pages.command.items.tasks')}
                  >
                    <CheckSquare />
                    <span>{t('pages.command.items.tasks')}</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => runCommand('pages.command.items.search')}
                  >
                    <CircleHelp />
                    <span>{t('pages.command.items.search')}</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </ShowcaseSection>
      </main>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { CommandShowcasePage };
