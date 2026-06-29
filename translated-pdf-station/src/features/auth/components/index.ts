/**
 * @file index.ts
 * @description Sub-barrel for the Auth feature's exposed components.
 *
 * The auth feature uniquely exposes its primary UI surface as
 * components (not as routed pages): a topbar trigger, a controlled
 * modal, and the modal Mount wrapper. The feature barrel re-exports
 * from THIS file rather than from each `./components/<Name>` path,
 * so the public API stays a flat set of names and the feature can
 * reorganise its internal component layout without breaking
 * consumers.
 */

// =================================================================================================
// Exports
// =================================================================================================

export { SignInButton } from './SignInButton';
export type { SignInButtonProps } from './SignInButton';

export { SignInModal } from './SignInModal';
export type { SignInModalProps, SignInSubmit } from './SignInModal';

export { SignInModalMount } from './SignInModalMount';
