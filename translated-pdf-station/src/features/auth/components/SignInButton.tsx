/**
 * @file SignInButton.tsx
 * @description Topbar trigger that opens the SignInModal.
 *
 * Defined once so every layout's topbar / rail can drop it in with a
 * single import (no `useOpenSignInModal` boilerplate in each layout
 * file).
 *
 * Renders one of two shapes — sized + spaced to line up with the
 * neighbouring `<ThemeToggle />` / `<LanguageSwitcher />` (size="sm",
 * `gap-1.5 px-2` so the icon-and-text pill matches their width):
 *
 *   - Signed out: outline `LogIn` icon + "Sign in" label → opens
 *     the modal.
 *   - Signed in:  ghost `LogOut` icon + "Sign out" label, with the
 *     active email surfaced via `title=` for cautious users hovering
 *     to confirm (avoids cluttering the topbar with a long string).
 *
 * The component is intentionally chrome-free (no positioning,
 * margins, or sizing on the wrapper) — each layout supplies its own
 * container.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { LogIn, LogOut } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { toast } from '@/shared/ui/toaster';

// --- Relative Imports ---
import {
  useAuthActions,
  useAuthSubmitting,
  useSignedInUser,
} from '../selectors';

// =================================================================================================
// Component
// =================================================================================================

interface SignInButtonProps {
  readonly className?: string;
}

function SignInButton({ className }: SignInButtonProps) {
  const { t } = useTranslation('auth');


  const user = useSignedInUser();
  const isSubmitting = useAuthSubmitting();
  const { openModal, signOut } = useAuthActions();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success(t('toast.signedOut'));
    } catch {
      toast.error(t('toast.error'));
    }
  };

  if (user) {
    const signOutLabel = t('trigger.signOut');
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isSubmitting}
        onClick={handleSignOut}
        aria-label={`${signOutLabel} (${user.email})`}
        title={t('trigger.signedInAs', { email: user.email })}
        className={cn('gap-1.5 px-2', className)}
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        <span className="hidden text-xs font-medium sm:inline">
          {signOutLabel}
        </span>
      </Button>
    );
  }

  const signInLabel = t('trigger.signIn');
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openModal()}
      aria-label={signInLabel}
      title={signInLabel}
      className={cn('gap-1.5 px-2', className)}
    >
      <LogIn aria-hidden="true" className="h-4 w-4" />
      <span className="hidden text-xs font-medium sm:inline">
        {signInLabel}
      </span>
    </Button>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { SignInButton };
export type { SignInButtonProps };
