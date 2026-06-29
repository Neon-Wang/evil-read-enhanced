/**
 * @file CounterPage.tsx
 * @description Route-level component for `/counter`.
 *
 * Wires the counter store actions to buttons and toasts. Demonstrates
 * the simpler shape pure-client features use — direct store reads,
 * no service/selector layer.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { Minus, Plus, RotateCcw } from 'lucide-react';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import { toast } from '@/shared/ui/toaster';

// --- Relative Imports ---
import { CounterDisplay } from '../components/CounterDisplay';
import { useCounterStore } from '../stores/counterStore';

// =================================================================================================
// Component
// =================================================================================================

function CounterPage() {
  const { t } = useTranslation('counter');


  const value = useCounterStore((s) => s.value);
  const increment = useCounterStore((s) => s.increment);
  const decrement = useCounterStore((s) => s.decrement);
  const reset = useCounterStore((s) => s.reset);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        <CounterDisplay value={value} />
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('current', { value })}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={() => {
              increment();
              toast.success(t('toastIncreased'));
            }}
          >
            <Plus className="h-4 w-4" />
            {t('increment')}
          </Button>
          <Button variant="secondary" onClick={decrement} disabled={value === 0}>
            <Minus className="h-4 w-4" />
            {t('decrement')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              toast(t('toastReset'));
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {t('reset')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { CounterPage };
