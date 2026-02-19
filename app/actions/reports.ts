'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

type DeleteReportResult = { error: string } | { success: true };

export async function deleteReport(reportId: string): Promise<DeleteReportResult> {
  const userId = await requireUserId();

  if (!reportId) {
    return { error: 'Missing report id.' };
  }

  const supabase = createServerClient();

  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('id')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle();

  if (reportError) {
    return { error: 'Could not verify report ownership.' };
  }

  if (!report) {
    return { error: 'Report not found.' };
  }

  const { error: deleteError } = await supabase
    .from('reports')
    .delete()
    .eq('id', reportId)
    .eq('user_id', userId);

  if (deleteError) {
    return { error: 'Failed to delete report.' };
  }

  revalidatePath('/dashboard/reports');
  return { success: true };
}
