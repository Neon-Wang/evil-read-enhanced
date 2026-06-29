/**
 * @file ProfileFormShowcase.tsx
 * @description Complex-form demo #2 — an account-profile form mixing text
 * inputs with a live-counted Textarea, a RadioGroup (visibility) and a
 * Switch (notifications), all bound through react-hook-form + zod. Shows
 * how non-text controls (`onCheckedChange` / `onValueChange`) plug into
 * the same FormField API.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';

// =================================================================================================
// Constants
// =================================================================================================

const BIO_MAX = 160;

// =================================================================================================
// Component
// =================================================================================================

function ProfileFormShowcase() {
  const { t } = useTranslation('examples');

  const schema = z.object({
    displayName: z.string().min(2, t('sections.profile.errName')),
    bio: z.string().max(BIO_MAX, t('sections.profile.errBio')),
    visibility: z.enum(['public', 'followers', 'private']),
    emailNotifications: z.boolean(),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      displayName: '',
      bio: '',
      visibility: 'public',
      emailNotifications: true,
    },
  });

  const bioValue = form.watch('bio');

  const onSubmit = form.handleSubmit(() => {
    toast.success(t('sections.profile.success'));
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-5">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sections.profile.name')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('sections.profile.namePlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sections.profile.bio')}</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder={t('sections.profile.bioPlaceholder')}
                  {...field}
                />
              </FormControl>
              <div className="flex items-center justify-between">
                <FormDescription>
                  {t('sections.profile.bioHint')}
                </FormDescription>
                <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
                  {bioValue.length}/{BIO_MAX}
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sections.profile.visibility')}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-col gap-2"
                >
                  {(['public', 'followers', 'private'] as const).map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <RadioGroupItem value={opt} id={`vis-${opt}`} />
                      <Label htmlFor={`vis-${opt}`} className="!mt-0 font-normal">
                        {t(`sections.profile.vis_${opt}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="emailNotifications"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--color-border)] p-3">
                <div className="flex flex-col gap-0.5">
                  <FormLabel className="!mt-0">
                    {t('sections.profile.notify')}
                  </FormLabel>
                  <FormDescription>
                    {t('sections.profile.notifyHint')}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </div>
            </FormItem>
          )}
        />

        <div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t('sections.profile.submit')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ProfileFormShowcase };
