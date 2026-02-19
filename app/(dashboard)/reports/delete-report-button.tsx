'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteReport } from '@/app/actions/reports';
import { Button } from '@/components/ui/button';

type DeleteReportButtonProps = {
  reportId: string;
  reportName: string;
};

export function DeleteReportButton({ reportId, reportName }: DeleteReportButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(`Delete "${reportName}"? This cannot be undone.`);
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteReport(reportId);

      if ('error' in result) {
        window.alert(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleDelete} disabled={isPending}>
      {isPending ? 'Deleting...' : 'Delete'}
    </Button>
  );
}
