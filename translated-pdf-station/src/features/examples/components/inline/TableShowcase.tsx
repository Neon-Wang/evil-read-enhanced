/**
 * @file TableShowcase.tsx
 * @description Inline showcase of the Table primitives — a small invoice
 * table with header, hoverable rows, a status Badge column and a footer
 * total row. Pure style demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Badge } from '@/shared/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';

// =================================================================================================
// Component
// =================================================================================================

function TableShowcase() {
  const { t } = useTranslation('examples');

  const rows = [
    { id: 'INV-001', status: 'paid', method: 'Visa', amount: '$250.00' },
    { id: 'INV-002', status: 'pending', method: 'PayPal', amount: '$150.00' },
    { id: 'INV-003', status: 'overdue', method: 'Bank', amount: '$420.00' },
  ] as const;

  const statusVariant = {
    paid: 'success',
    pending: 'warning',
    overdue: 'destructive',
  } as const;

  return (
    <Table className="max-w-2xl">
      <TableCaption>{t('sections.table.caption')}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('sections.table.invoice')}</TableHead>
          <TableHead>{t('sections.table.status')}</TableHead>
          <TableHead>{t('sections.table.method')}</TableHead>
          <TableHead className="text-right">
            {t('sections.table.amount')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[row.status]}>
                {t(`sections.table.statuses.${row.status}`)}
              </Badge>
            </TableCell>
            <TableCell>{row.method}</TableCell>
            <TableCell className="text-right">{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>{t('sections.table.total')}</TableCell>
          <TableCell className="text-right">$820.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TableShowcase };
