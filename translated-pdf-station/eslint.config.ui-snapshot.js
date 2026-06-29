/**
 * @file eslint.config.ui-snapshot.js
 * @description Override block emitted by `applyUiSnapshot` for `--ui shadcn`.
 *
 * The vendored UI primitives under `src/shared/ui/` (and any extra
 * helper paths the registry ships, e.g. animate-ui's
 * `src/components/animate-ui/`) come from upstream verbatim and
 * don't carry the project's banner / import-order / max-lines
 * conventions. This config disables those rules on those paths
 * only — `eslint.config.js` lazy-imports this file at the very end
 * of its rule list, so this file does NOT exist for `--ui custom`.
 *
 * Regenerate by re-running `npx create-eikon-react` with the same
 * `--ui shadcn` flag, or by editing this file in place if you want
 * to tighten the lint surface.
 */

export default [
  {
    files: [
    'src/shared/ui/button.tsx',
    'src/shared/ui/dialog.tsx',
    'src/shared/ui/tabs.tsx',
    'src/shared/ui/sheet.tsx',
    'src/shared/ui/command.tsx',
    'src/shared/ui/card.tsx',
    'src/shared/ui/toaster.tsx',
    'src/shared/ui/input.tsx',
    'src/shared/ui/textarea.tsx',
    'src/shared/ui/label.tsx',
    'src/shared/ui/select.tsx',
    'src/shared/ui/checkbox.tsx',
    'src/shared/ui/radio-group.tsx',
    'src/shared/ui/switch.tsx',
    'src/shared/ui/badge.tsx',
    'src/shared/ui/avatar.tsx',
    'src/shared/ui/skeleton.tsx',
    'src/shared/ui/tooltip.tsx',
    'src/shared/ui/popover.tsx',
    'src/shared/ui/alert.tsx',
    ],
    rules: {
    'eikon/file-header-banner': 'off',
    'eikon/filename-matches-export': 'off',
    'eikon/filename-case-by-path': 'off',
    'import/no-default-export': 'off',
    'import/order': 'off',
    'max-lines': 'off',
    '@typescript-eslint/consistent-type-imports': 'off',
    'react-refresh/only-export-components': 'off',
    },
  },
];
