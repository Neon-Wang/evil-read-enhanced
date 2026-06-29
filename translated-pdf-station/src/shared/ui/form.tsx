/**
 * @file form.tsx
 * @description react-hook-form binding layer (shadcn lineage). These
 * thin wrappers wire RHF's field state into accessible markup so each
 * field gets a stable id, `aria-describedby`/`aria-invalid` plumbing and
 * an auto-rendered validation message — without the consumer hand-rolling
 * any of it.
 *
 * Usage:
 *
 *   <Form {...form}>
 *     <form onSubmit={form.handleSubmit(onSubmit)}>
 *       <FormField name="email" control={form.control} render={({ field }) => (
 *         <FormItem>
 *           <FormLabel>Email</FormLabel>
 *           <FormControl><Input type="email" {...field} /></FormControl>
 *           <FormMessage />
 *         </FormItem>
 *       )} />
 *     </form>
 *   </Form>
 *
 * `FormMessage` reads the active field error straight from RHF, so its
 * text is whatever your resolver (e.g. zod) produced — keep validation
 * messages translatable by building the schema with `t(...)`.
 *
 * Tokens: error states paint with `--color-destructive`; descriptions use
 * `--color-muted-foreground`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Third-party Libraries ---
import { Slot } from '@radix-ui/react-slot';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';
import { Label } from '@/shared/ui/label';

// =================================================================================================
// Field context
// =================================================================================================

const Form = FormProvider;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

interface FormItemContextValue {
  id: string;
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>');
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

// =================================================================================================
// Layout pieces
// =================================================================================================

function FormItem({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn('flex flex-col gap-1.5', className)} {...props} />
    </FormItemContext.Provider>
  );
}

function FormLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Label>) {
  const { error, formItemId } = useFormField();
  return (
    <Label
      htmlFor={formItemId}
      className={cn(error && 'text-[var(--color-destructive)]', className)}
      {...props}
    />
  );
}

function FormControl(props: React.ComponentPropsWithoutRef<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();
  return (
    <Slot
      id={formItemId}
      aria-describedby={
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}

function FormDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'p'>) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      id={formDescriptionId}
      className={cn('text-xs text-[var(--color-muted-foreground)]', className)}
      {...props}
    />
  );
}

function FormMessage({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<'p'>) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? '') : children;

  if (!body) return null;

  return (
    <p
      id={formMessageId}
      className={cn(
        'text-xs font-medium text-[var(--color-destructive)]',
        className
      )}
      {...props}
    >
      {body}
    </p>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
};
// eslint-disable-next-line react-refresh/only-export-components
export { useFormField };
