/**
 * @file index.js
 * @description Entry point for the local `eslint-plugin-eikon` flat-config
 * plugin. Bundles the three AI-friendly source-layout rules that the
 * template enforces in its quality gate.
 *
 * This plugin has zero npm dependencies. It ships INSIDE the template
 * (under `eslint-rules/`) so that every project scaffolded from
 * `create-eikon-react` inherits the same enforcement out of the box,
 * with no extra `npm install` step.
 *
 * Wiring (see `eslint.config.js`):
 *
 *   import eikon from './eslint-rules/index.js';
 *   export default tseslint.config(
 *     {
 *       plugins: { eikon },
 *       rules: {
 *         'eikon/file-header-banner': 'error',
 *         'eikon/filename-matches-export': 'error',
 *         'eikon/filename-case-by-path': ['error', { rules: [...] }],
 *       },
 *     },
 *   );
 */

import fileHeaderBanner from './rules/file-header-banner.js';
import filenameCaseByPath from './rules/filename-case-by-path.js';
import filenameMatchesExport from './rules/filename-matches-export.js';

const plugin = {
  meta: {
    name: 'eslint-plugin-eikon',
    version: '1.0.0',
  },
  rules: {
    'file-header-banner': fileHeaderBanner,
    'filename-matches-export': filenameMatchesExport,
    'filename-case-by-path': filenameCaseByPath,
  },
};

export default plugin;
