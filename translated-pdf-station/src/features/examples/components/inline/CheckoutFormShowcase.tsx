/**
 * @file CheckoutFormShowcase.tsx
 * @description Complex-form demo #3 — a checkout form with a two-column
 * layout, a Select-bound shipping method and an optional notes field, all
 * validated through react-hook-form + zod. Shows Select binding via
 * `onValueChange` and an optional field that never blocks submit.
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

// =================================================================================================
// Component
// =================================================================================================

function CheckoutFormShowcase() {
  const { t } = useTranslation('examples');

  const schema = z.object({
    fullName: z.string().min(2, t('sections.checkout.errName')),
    email: z.email(t('sections.checkout.errEmail')),
    address: z.string().min(5, t('sections.checkout.errAddress')),
    city: z.string().min(2, t('sections.checkout.errCity')),
    shippingMethod: z.enum(['standard', 'express', 'pickup'], {
      message: t('sections.checkout.errShipping'),
    }),
    notes: z.string().max(280, t('sections.checkout.errNotes')).optional(),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      email: '',
      address: '',
      city: '',
      shippingMethod: undefined,
      notes: '',
    },
  });

  const onSubmit = form.handleSubmit(() => {
    toast.success(t('sections.checkout.success'));
    form.reset();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('sections.checkout.name')}</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('sections.checkout.email')}</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sections.checkout.address')}</FormLabel>
              <FormControl>
                <Input autoComplete="street-address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('sections.checkout.city')}</FormLabel>
                <FormControl>
                  <Input autoComplete="address-level2" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shippingMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('sections.checkout.shipping')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('sections.checkout.shippingPlaceholder')}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="standard">
                      {t('sections.checkout.ship_standard')}
                    </SelectItem>
                    <SelectItem value="express">
                      {t('sections.checkout.ship_express')}
                    </SelectItem>
                    <SelectItem value="pickup">
                      {t('sections.checkout.ship_pickup')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sections.checkout.notes')}</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder={t('sections.checkout.notesPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t('sections.checkout.submit')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { CheckoutFormShowcase };
