/**
 * @file FormShowcase.tsx
 * @description Inline showcase of the form-control primitives — Input,
 * Textarea, Select, Checkbox, RadioGroup and Switch — so the showcase
 * page demonstrates the whole input vocabulary, not just Button/Card/Tabs.
 *
 * Pure style demo: controls are uncontrolled (defaultChecked / defaultValue)
 * so there's no app state to wire — the point is the rendered appearance of
 * each primitive under the active design preset.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';

// =================================================================================================
// Component
// =================================================================================================

function FormShowcase() {
  const { t } = useTranslation('examples');

  return (
    <div className="flex flex-col gap-6">
      <Group label={t('sections.form.textLabel')}>
        <div className="flex w-full max-w-xs flex-col gap-1.5">
          <Label htmlFor="demo-email">{t('sections.form.emailLabel')}</Label>
          <Input
            id="demo-email"
            type="email"
            placeholder={t('sections.form.emailPlaceholder')}
          />
        </div>
        <div className="flex w-full max-w-xs flex-col gap-1.5">
          <Label htmlFor="demo-note">{t('sections.form.noteLabel')}</Label>
          <Textarea
            id="demo-note"
            placeholder={t('sections.form.notePlaceholder')}
          />
        </div>
      </Group>

      <Group label={t('sections.form.selectLabel')}>
        <Select>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder={t('sections.form.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">{t('sections.form.optApple')}</SelectItem>
            <SelectItem value="banana">
              {t('sections.form.optBanana')}
            </SelectItem>
            <SelectItem value="cherry">
              {t('sections.form.optCherry')}
            </SelectItem>
          </SelectContent>
        </Select>
      </Group>

      <Group label={t('sections.form.toggleLabel')}>
        <div className="flex items-center gap-2">
          <Checkbox id="demo-terms" defaultChecked />
          <Label htmlFor="demo-terms">{t('sections.form.termsLabel')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="demo-notify" defaultChecked />
          <Label htmlFor="demo-notify">{t('sections.form.notifyLabel')}</Label>
        </div>
      </Group>

      <Group label={t('sections.form.radioLabel')}>
        <RadioGroup defaultValue="standard" className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="standard" id="demo-ship-standard" />
            <Label htmlFor="demo-ship-standard">
              {t('sections.form.shipStandard')}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="express" id="demo-ship-express" />
            <Label htmlFor="demo-ship-express">
              {t('sections.form.shipExpress')}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="pickup" id="demo-ship-pickup" />
            <Label htmlFor="demo-ship-pickup">
              {t('sections.form.shipPickup')}
            </Label>
          </div>
        </RadioGroup>
      </Group>
    </div>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { FormShowcase };
