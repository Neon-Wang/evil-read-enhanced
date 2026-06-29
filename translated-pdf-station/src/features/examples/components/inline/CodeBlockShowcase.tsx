/**
 * @file CodeBlockShowcase.tsx
 * @description Inline showcase of the CodeBlock primitive — a code panel
 * with a language label and a copy-to-clipboard button. Pure style demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { CodeBlock } from '@/shared/ui/code-block';

// =================================================================================================
// Component
// =================================================================================================

const SAMPLE = `import { Button } from '@/shared/ui/button';

export function Cta() {
  return <Button>Get started</Button>;
}`;

function CodeBlockShowcase() {
  const { t } = useTranslation('examples');

  return (
    <CodeBlock
      className="max-w-xl"
      language="tsx"
      code={SAMPLE}
      copyLabel={t('sections.codeblock.copyLabel')}
    />
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { CodeBlockShowcase };
