/**
 * @file DialogShowcasePage.tsx
 * @description Route-level component for `/examples/dialog`.
 *
 * Four sections, each a `<ShowcaseSection>` so the page mirrors the
 * structure of every other showcase route:
 *
 *   - Basics      — informational / form / destructive triplets.
 *   - Sizes       — sm / md / lg / xl / fullscreen width matrix.
 *   - Nested      — confirmation dialog opened on top of a parent
 *                   dialog; demonstrates Radix's portal stacking +
 *                   our AnimatePresence exit-on-close behaviour.
 *   - Fullscreen  — a `max-w-none w-screen h-screen` flavour for
 *                   mobile-shell flows where the modal IS the page.
 *
 * Each dialog uses uncontrolled open state (the `defaultOpen` /
 * Trigger pattern Radix provides) so the demo doesn't need its own
 * React state just to toggle visibility — except the Nested + Form
 * dialogs that need it to coordinate two-level state.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { Trash2 } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { toast } from '@/shared/ui/toaster';

// --- Relative Imports ---
import { ShowcasePageHeader } from '../components/ShowcasePageHeader';
import { ShowcaseSection } from '../components/ShowcaseSection';

// =================================================================================================
// Constants
// =================================================================================================

/**
 * Width presets layered on top of DialogContent's default
 * `max-w-lg`. Order intentionally narrow → wide so the demo row
 * reads left to right in increasing footprint.
 */
const SIZE_PRESETS = [
  { key: 'sm', className: 'sm:max-w-sm' },
  { key: 'md', className: 'sm:max-w-md' },
  { key: 'lg', className: 'sm:max-w-lg' },
  { key: 'xl', className: 'sm:max-w-2xl' },
] as const;

// =================================================================================================
// Component
// =================================================================================================

function DialogShowcasePage() {
  const { t } = useTranslation('examples');


  return (
    <div className="flex flex-col gap-8">
      <ShowcasePageHeader
        showBack
        title={t('pages.dialog.title')}
        subtitle={t('pages.dialog.description')}
      />

      <main className="flex flex-col gap-12">
        <ShowcaseSection
          anchor="dialog-basics"
          eyebrow={t('pages.dialog.basics.eyebrow')}
          title={t('pages.dialog.basics.title')}
          description={t('pages.dialog.basics.description')}
        >
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button>{t('pages.dialog.basics.openLabel')}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('pages.dialog.basics.openLabel')}</DialogTitle>
                  <DialogDescription>
                    {t('pages.dialog.basics.description')}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t('pages.dialog.cancel')}</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <FormDialog
              label={t('pages.dialog.basics.openWithFormLabel')}
              t={t}
            />

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  {t('pages.dialog.basics.openDestructiveLabel')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {t('pages.dialog.basics.openDestructiveLabel')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('pages.dialog.basics.destructiveLead')}
                  </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {t('pages.dialog.basics.destructiveDetail')}
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t('pages.dialog.cancel')}</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        toast.success(
                          t('pages.dialog.basics.destructiveDoneToast')
                        )
                      }
                    >
                      {t('pages.dialog.basics.destructiveConfirm')}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          anchor="dialog-sizes"
          eyebrow={t('pages.dialog.sizes.eyebrow')}
          title={t('pages.dialog.sizes.title')}
          description={t('pages.dialog.sizes.description')}
        >
          <div className="flex flex-wrap gap-3">
            {SIZE_PRESETS.map((preset) => (
              <Dialog key={preset.key}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    {t(`pages.dialog.sizes.${preset.key}`)}
                  </Button>
                </DialogTrigger>
                <DialogContent className={preset.className}>
                  <DialogHeader>
                    <DialogTitle>
                      {t(`pages.dialog.sizes.${preset.key}`)}
                    </DialogTitle>
                    <DialogDescription>
                      {t('pages.dialog.sizes.body', {
                        size: t(`pages.dialog.sizes.${preset.key}`),
                      })}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">
                        {t('pages.dialog.cancel')}
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          anchor="dialog-nested"
          eyebrow={t('pages.dialog.nested.eyebrow')}
          title={t('pages.dialog.nested.title')}
          description={t('pages.dialog.nested.description')}
        >
          <NestedDialogDemo t={t} />
        </ShowcaseSection>

        <ShowcaseSection
          anchor="dialog-fullscreen"
          eyebrow={t('pages.dialog.fullscreen.eyebrow')}
          title={t('pages.dialog.fullscreen.title')}
          description={t('pages.dialog.fullscreen.description')}
        >
          <Dialog>
            <DialogTrigger asChild>
              <Button>{t('pages.dialog.fullscreen.openLabel')}</Button>
            </DialogTrigger>
            <DialogContent
              className={cn(
                // Override the centred, rounded card chrome with a
                // viewport-filling sheet. `inset-0` + `translate-none`
                // overrides the default left-1/2 / -translate-x-1/2
                // centering preset.
                'left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none p-0',
                'flex flex-col bg-[var(--color-background)]'
              )}
            >
              <DialogHeader className="border-b border-[var(--color-border)] p-6">
                <DialogTitle>
                  {t('pages.dialog.fullscreen.title')}
                </DialogTitle>
                <DialogDescription>
                  {t('pages.dialog.fullscreen.body')}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto px-6 py-8 text-sm text-[var(--color-muted-foreground)]">
                <p>{t('pages.dialog.fullscreen.bodyDetail')}</p>
              </div>
              <DialogFooter className="border-t border-[var(--color-border)] p-4">
                <DialogClose asChild>
                  <Button variant="outline">{t('pages.dialog.cancel')}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>{t('pages.dialog.fullscreen.confirm')}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ShowcaseSection>
      </main>
    </div>
  );
}

// =================================================================================================
// Form dialog (extracted because it owns local state)
// =================================================================================================

interface DialogTFn {
  (key: string, options?: Record<string, unknown>): string;
}

interface FormDialogProps {
  label: string;
  t: DialogTFn;
}

function FormDialog({ label, t }: FormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState('');

  const handleSave = () => {
    toast.success(t('pages.dialog.basics.savedToast'));
    setNote('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.dialog.basics.formTitle')}</DialogTitle>
          <DialogDescription>
            {t('pages.dialog.basics.formDescription')}
          </DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('pages.dialog.basics.noteLabel')}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('pages.dialog.basics.notePlaceholder')}
            rows={4}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </label>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('pages.dialog.cancel')}</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={note.trim().length === 0}>
            {t('pages.dialog.basics.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================================================
// Nested dialog (parent + confirm-on-top)
// =================================================================================================

interface NestedDialogDemoProps {
  t: DialogTFn;
}

/**
 * Two dialogs stacked: the parent hosts a destructive action that opens
 * a sub-dialog confirming the action. Closing the sub-dialog leaves the
 * parent open so the user can pick another action — Radix's portal
 * stack handles z-index ordering for us; AnimatePresence in each
 * `<Dialog>` handles the exit animation independently.
 */
function NestedDialogDemo({ t }: NestedDialogDemoProps) {
  const [parentOpen, setParentOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleConfirm = () => {
    toast.success(t('pages.dialog.nested.confirmedToast'));
    setConfirmOpen(false);
    setParentOpen(false);
  };

  return (
    <Dialog open={parentOpen} onOpenChange={setParentOpen}>
      <DialogTrigger asChild>
        <Button>{t('pages.dialog.nested.openLabel')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.dialog.nested.parentTitle')}</DialogTitle>
          <DialogDescription>
            {t('pages.dialog.nested.parentBody')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('pages.dialog.cancel')}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t('pages.dialog.nested.confirmTrigger')}
          </Button>
        </DialogFooter>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {t('pages.dialog.nested.confirmTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('pages.dialog.nested.confirmBody')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">
                  {t('pages.dialog.cancel')}
                </Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleConfirm}>
                {t('pages.dialog.nested.confirmFinal')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { DialogShowcasePage };
