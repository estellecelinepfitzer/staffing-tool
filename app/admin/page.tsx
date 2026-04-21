export const dynamic = 'force-dynamic';

import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getActiveTeamMembers } from '@/lib/db';
import DashboardPasswordGate from '@/app/dashboard/DashboardPasswordGate';
import AdminClient from './AdminClient';

export default function AdminPage() {
  if (!isAdminAuthenticated()) {
    return <DashboardPasswordGate />;
  }

  const members = getActiveTeamMembers();

  return <AdminClient members={members} />;
}
