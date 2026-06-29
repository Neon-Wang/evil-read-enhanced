/**
 * @file CollapseShowcase.tsx
 * @description Inline showcase of the Accordion ("Collapse") primitive —
 * a single-open accordion with three panels. Pure style demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion';

// =================================================================================================
// Component
// =================================================================================================

function CollapseShowcase() {
  const { t } = useTranslation('examples');

  return (
    <Accordion type="single" defaultValue="shipping" className="max-w-xl">
      <AccordionItem value="shipping">
        <AccordionTrigger>{t('sections.collapse.q1')}</AccordionTrigger>
        <AccordionContent>{t('sections.collapse.a1')}</AccordionContent>
      </AccordionItem>
      <AccordionItem value="returns">
        <AccordionTrigger>{t('sections.collapse.q2')}</AccordionTrigger>
        <AccordionContent>{t('sections.collapse.a2')}</AccordionContent>
      </AccordionItem>
      <AccordionItem value="support">
        <AccordionTrigger>{t('sections.collapse.q3')}</AccordionTrigger>
        <AccordionContent>{t('sections.collapse.a3')}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { CollapseShowcase };
