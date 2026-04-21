export const dynamic = 'force-dynamic';

import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getAllCycles } from '@/lib/db';
import DashboardPasswordGate from '@/app/dashboard/DashboardPasswordGate';
import ReviewsClient from './ReviewsClient';

export default function ReviewsPage() {
  if (!isAdminAuthenticated()) {
    return <DashboardPasswordGate />;
  }

  const cycles = getAllCycles();

  return <ReviewsClient cycles={cycles} />;
}
