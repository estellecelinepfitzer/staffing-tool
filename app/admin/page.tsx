export const dynamic = 'force-dynamic';

import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getAllTeamMembers, getAllCycles } from '@/lib/db';
import AdminLogin from './AdminLogin';
import AdminClient from './AdminClient';

export default function AdminPage() {
  if (!isAdminAuthenticated()) {
    return <AdminLogin />;
  }

  const members = getAllTeamMembers();
  const cycles = getAllCycles();

  return <AdminClient members={members} cycles={cycles} />;
}
