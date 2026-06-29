/**
 * @file BreadcrumbShowcase.tsx
 * @description Inline showcase of the Breadcrumb trail — a typical
 * three-level path plus a collapsed (ellipsis) variant. Pure style demo;
 * links are inert (`href="#"`).
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb';

// =================================================================================================
// Component
// =================================================================================================

function BreadcrumbShowcase() {
  const { t } = useTranslation('examples');

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#">
              {t('sections.breadcrumb.home')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="#">
              {t('sections.breadcrumb.components')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('sections.breadcrumb.current')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#">
              {t('sections.breadcrumb.home')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span aria-hidden="true">…</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('sections.breadcrumb.current')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { BreadcrumbShowcase };
