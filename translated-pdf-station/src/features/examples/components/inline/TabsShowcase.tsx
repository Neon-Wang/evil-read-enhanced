/**
 * @file TabsShowcase.tsx
 * @description Inline showcase of the Tabs primitive — three triggers
 * with the active panel reading from Radix's `data-state="active"`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

// =================================================================================================
// Component
// =================================================================================================

function TabsShowcase() {
  const { t } = useTranslation('examples');


  return (
    <Tabs defaultValue="account" className="w-full">
      <TabsList>
        <TabsTrigger value="account">
          {t('sections.tabs.accountTab')}
        </TabsTrigger>
        <TabsTrigger value="password">
          {t('sections.tabs.passwordTab')}
        </TabsTrigger>
        <TabsTrigger value="preferences">
          {t('sections.tabs.preferencesTab')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('sections.tabs.accountBody')}
        </p>
      </TabsContent>
      <TabsContent value="password">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('sections.tabs.passwordBody')}
        </p>
      </TabsContent>
      <TabsContent value="preferences">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('sections.tabs.preferencesBody')}
        </p>
      </TabsContent>
    </Tabs>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TabsShowcase };
