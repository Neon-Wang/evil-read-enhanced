/**
 * @file SignUpFormShowcase.tsx
 * @description Complex-form demo #1 — a sign-up form wired with
 * react-hook-form + a zod schema. Demonstrates required fields, email
 * format, password strength, cross-field confirm-password matching and a
 * "must accept terms" gate. Validation messages are built through `t(...)`
 * so they stay translatable. On a valid submit it fires a success toast
 * and resets.
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
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';

// =================================================================================================
// Component
// =================================================================================================

function SignUpFormShowcase() {
  const { t } = useTranslation('examples');

  const schema = z
    .object({
      username: z.string().min(3, t('sections.signup.errUsername')),
      email: z.email(t('sections.signup.errEmail')),
      password: z
        .string()
        .min(8, t('sections.signup.errPasswordMin'))
        .regex(/(?=.*[A-Za-z])(?=.*\d)/, t('sections.signup.errPasswordWeak')),
      confirmPassword: z.string(),
      acceptTerms: z.boolean(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t('sections.signup.errConfirm'),
      path: ['confirmPassword'],
    })
    .refine((d) => d.acceptTerms, {
      message: t('sections.signup.errTerms'),
      path: ['acceptTerms'],
    });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const onSubmit = form.handleSubmit(() => {
    toast.success(t('sections.signup.success'));
    form.reset();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="flex max-w-sm flex-col gap-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sections.signup.username')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('sections.signup.usernamePlaceholder')}
                  autoComplete="username"
                  {...field}
                />
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
              <FormLabel>{t('sections.signup.email')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t('sections.signup.emailPlaceholder')}
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sections.signup.password')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sections.signup.confirmPassword')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="!mt-0">
                  {t('sections.signup.terms')}
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t('sections.signup.submit')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            {t('sections.signup.reset')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { SignUpFormShowcase };
