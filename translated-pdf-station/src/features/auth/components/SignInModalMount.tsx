/**
 * @file SignInModalMount.tsx
 * @description Store-bound wrapper around <SignInModal />.
 *
 * Mount once at app root (typically inside `app/providers.tsx`,
 * next to <Toaster />). The actual modal is fully controlled and
 * subscribes to the auth store — any code anywhere in the app can
 * call `useOpenSignInModal()()` to open it.
 *
 * Toast feedback for success / failure lives here (NOT in the
 * primitive) so projects can swap toast presets without touching
 * the modal's own render logic.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { loadNamespace } from '@/shared/i18n';

import { toast } from '@/shared/ui/toaster';

// --- Relative Imports ---
import {
  useAuthActions,
  useAuthError,
  useAuthSubmitting,
  useShowSignInModal,
  useSignInMode,
} from '../selectors';
import { AuthMode } from '../types';

import { SignInModal } from './SignInModal';

import type { SignInSubmit } from './SignInModal';
import type { OAuthProvider } from '../types';

// =================================================================================================
// Component
// =================================================================================================

function SignInModalMount() {
  const open = useShowSignInModal();
  const mode = useSignInMode();
  const isSubmitting = useAuthSubmitting();
  const error = useAuthError();
  const {
    setMode,
    closeModal,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
  } = useAuthActions();

  const { t } = useTranslation('auth');

  // Pre-load the auth namespace once so the modal renders translated
  // copy on first open instead of suspending on the lazy bundle.
  React.useEffect(() => {
    void loadNamespace('auth');
  }, []);


  const handleSubmit = async (out: SignInSubmit) => {
    try {
      if (out.mode === AuthMode.SIGN_IN) {
        await signInWithEmail(out.payload);
      } else {
        await signUpWithEmail(out.payload);
      }
      toast.success(t('toast.signedIn'));
    } catch {
      // The store has already recorded the error message into
      // `state.error`, which the modal renders inline. Surface a
      // generic toast in addition so users see SOMETHING when the
      // modal is mid-transition.
      toast.error(t('toast.error'));
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    try {
      await signInWithOAuth(provider);
      toast.success(t('toast.signedIn'));
    } catch {
      toast.error(t('toast.error'));
    }
  };

  return (
    <SignInModal
      open={open}
      onOpenChange={(next) => {
        if (!next) closeModal();
      }}
      mode={mode}
      onModeChange={setMode}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit}
      onOAuth={handleOAuth}
    />
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { SignInModalMount };
