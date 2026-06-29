/**
 * @file SignInModal.tsx
 * @description Composite auth Modal — Sign in / Sign up tabs with
 * email/password form + OAuth provider buttons.
 *
 * Receives `open / onOpenChange / mode / onModeChange / isSubmitting /
 * error / onSubmit / onOAuth` as props so it stays fully controlled.
 * The store binding lives in `<SignInModalMount />`; examples and
 * tests can render this component directly with local React state.
 *
 * The form is owned here (one piece of local React state per input)
 * since the values reset whenever the modal closes — there's no
 * cross-mode persistence to push up.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { Loader2 } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

// --- Relative Imports ---
import { AuthMode, OAuthProvider } from '../types';

import type { SignInPayload, SignUpPayload } from '../types';

// =================================================================================================
// Types
// =================================================================================================

/**
 * Submit payload union. The discriminator (`mode`) lets the parent
 * branch on the correct payload shape without an extra type guard:
 *
 *   if (out.mode === 'signin') { ... out.payload: SignInPayload }
 *   else                       { ... out.payload: SignUpPayload }
 */
type SignInSubmit =
  | { mode: typeof AuthMode.SIGN_IN; payload: SignInPayload }
  | { mode: typeof AuthMode.SIGN_UP; payload: SignUpPayload };

interface SignInModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: AuthMode;
  readonly onModeChange: (mode: AuthMode) => void;
  readonly isSubmitting?: boolean;
  readonly error?: string | null;
  readonly onSubmit: (out: SignInSubmit) => void | Promise<void>;
  readonly onOAuth?: (provider: OAuthProvider) => void | Promise<void>;
}

// =================================================================================================
// Inline icons
// =================================================================================================

/**
 * Single-colour Google "G" mark. Kept inline because lucide doesn't
 * ship a Google icon and pulling in `react-icons` just for one mark
 * is wasteful. `currentColor` so the icon picks up the button's text
 * colour (no extra theming work).
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21.35 11.1H12v3.2h5.35c-.5 2.4-2.55 4.1-5.35 4.1-3.25 0-5.9-2.65-5.9-5.9s2.65-5.9 5.9-5.9c1.5 0 2.85.55 3.9 1.45l2.4-2.4C16.55 4.1 14.4 3.2 12 3.2 6.95 3.2 2.85 7.3 2.85 12.35s4.1 9.15 9.15 9.15c5.3 0 8.8-3.7 8.8-8.95 0-.5-.05-1-.15-1.45z" />
    </svg>
  );
}

// =================================================================================================
// Component
// =================================================================================================

// Inline GitHub mark — `lucide-react` v1 dropped its brand icons, and we
// don't want to take a second icon-package dependency for one button.
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.18-.02-2.13-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.97 10.97 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function SignInModal({
  open,
  onOpenChange,
  mode,
  onModeChange,
  isSubmitting = false,
  error,
  onSubmit,
  onOAuth,
}: SignInModalProps) {
  const { t } = useTranslation('auth');


  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Reset the form values whenever the modal closes so the next open
  // starts clean — the parent owns the open state so we react to it
  // here rather than firing reset on every onOpenChange.
  React.useEffect(() => {
    if (!open) {
      setEmail('');
      setPassword('');
      setFullName('');
      setValidationError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
      setValidationError(t('validation.emailRequired'));
      return;
    }
    if (!password) {
      setValidationError(t('validation.passwordRequired'));
      return;
    }
    setValidationError(null);

    if (mode === AuthMode.SIGN_IN) {
      await onSubmit({
        mode: AuthMode.SIGN_IN,
        payload: { email: email.trim(), password },
      });
    } else {
      await onSubmit({
        mode: AuthMode.SIGN_UP,
        payload: {
          email: email.trim(),
          password,
          fullName: fullName.trim() || undefined,
        },
      });
    }
  };

  const handleTabChange = (next: string) => {
    if (next === AuthMode.SIGN_IN || next === AuthMode.SIGN_UP) {
      onModeChange(next);
      setValidationError(null);
    }
  };

  const isSignIn = mode === AuthMode.SIGN_IN;
  const displayError = validationError ?? error ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSignIn ? t('signIn.title') : t('signUp.title')}
          </DialogTitle>
          <DialogDescription>
            {isSignIn ? t('signIn.subtitle') : t('signUp.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={handleTabChange}
          className="mt-2"
        >
          <TabsList className="w-full">
            <TabsTrigger
              value={AuthMode.SIGN_IN}
              className="flex-1"
            >
              {t('tabs.signIn')}
            </TabsTrigger>
            <TabsTrigger
              value={AuthMode.SIGN_UP}
              className="flex-1"
            >
              {t('tabs.signUp')}
            </TabsTrigger>
          </TabsList>

          {/* Render BOTH TabsContent so Radix keeps focus management +
              a11y wiring intact; the inactive panel is hidden via
              Radix's `hidden` attribute, so the form lives entirely
              outside the loop. */}
          {[AuthMode.SIGN_IN, AuthMode.SIGN_UP].map((tab) => (
            <TabsContent key={tab} value={tab}>
              {tab === mode && (
                <form
                  className="flex flex-col gap-4"
                  onSubmit={handleSubmit}
                  noValidate
                >
                  {mode === AuthMode.SIGN_UP && (
                    <Field
                      id="auth-fullname"
                      label={t('fields.fullName')}
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={setFullName}
                      disabled={isSubmitting}
                    />
                  )}
                  <Field
                    id="auth-email"
                    label={t('fields.email')}
                    type="email"
                    autoComplete="email"
                    placeholder={t('fields.emailPlaceholder')}
                    value={email}
                    onChange={setEmail}
                    disabled={isSubmitting}
                    required
                  />
                  <Field
                    id="auth-password"
                    label={t('fields.password')}
                    type="password"
                    autoComplete={
                      mode === AuthMode.SIGN_IN
                        ? 'current-password'
                        : 'new-password'
                    }
                    placeholder={t('fields.passwordPlaceholder')}
                    value={password}
                    onChange={setPassword}
                    disabled={isSubmitting}
                    required
                  />

                  {displayError && (
                    <p
                      role="alert"
                      className="text-sm text-[var(--color-destructive)]"
                    >
                      {displayError}
                    </p>
                  )}

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {isSubmitting
                      ? isSignIn
                        ? t('signIn.submitting')
                        : t('signUp.submitting')
                      : isSignIn
                        ? t('signIn.submit')
                        : t('signUp.submit')}
                  </Button>
                </form>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {onOAuth && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <span className="h-px flex-1 bg-[var(--color-border)]" />
              {t('oauth.divider')}
              <span className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => void onOAuth(OAuthProvider.GOOGLE)}
              >
                <GoogleIcon className="h-4 w-4" />
                {t('oauth.google')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => void onOAuth(OAuthProvider.GITHUB)}
              >
                <GitHubMark className="h-4 w-4" />
                {t('oauth.github')}
              </Button>
            </div>
          </>
        )}

        <p className="mt-2 text-center text-xs text-[var(--color-muted-foreground)]">
          {isSignIn ? t('signIn.noAccount') : t('signUp.haveAccount')}{' '}
          <button
            type="button"
            className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
            onClick={() =>
              handleTabChange(
                isSignIn ? AuthMode.SIGN_UP : AuthMode.SIGN_IN
              )
            }
            disabled={isSubmitting}
          >
            {isSignIn ? t('signIn.switchToSignUp') : t('signUp.switchToSignIn')}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================================================
// Field (local helper)
// =================================================================================================

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'text' | 'email' | 'password';
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly autoComplete?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
  required,
}: FieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-[var(--color-foreground)]">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={cn(
          'rounded-md border-[length:var(--surface-border-width)] border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm shadow-[var(--surface-inset-shadow)]',
          'placeholder:text-[var(--color-muted-foreground)]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          'disabled:cursor-not-allowed disabled:opacity-60'
        )}
      />
    </label>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { SignInModal };
export type { SignInModalProps, SignInSubmit };
