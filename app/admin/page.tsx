export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getAllTeamMembers, getAllCycles, getAllCategories, getSetting } from '@/lib/db';
import AdminClient from './AdminClient';

export default function AdminPage() {
  if (!isAdminAuthenticated()) {
    redirect('/login');
  }

  const members = getAllTeamMembers();
  const cycles = getAllCycles();
  const categories = getAllCategories().filter((c) => c.active);
  const mondayDigestEnabled = getSetting('monday_digest_enabled') !== 'false';

  return <AdminClient members={members} cycles={cycles} categories={categories} mondayDigestEnabled={mondayDigestEnabled} />;
}
