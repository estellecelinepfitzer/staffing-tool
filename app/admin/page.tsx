export const dynamic = 'force-dynamic';

import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getAllTeamMembers, getAllCycles, getAllCategories } from '@/lib/db';
import AdminLogin from './AdminLogin';
import AdminClient from './AdminClient';

export default function AdminPage() {
  if (!isAdminAuthenticated()) {
    return <AdminLogin />;
  }

  const members = getAllTeamMembers();
  const cycles = getAllCycles();
  const categories = getAllCategories().filter((c) => c.active);

  return <AdminClient members={members} cycles={cycles} categories={categories} />;
}
