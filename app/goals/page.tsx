export const dynamic = 'force-dynamic';

import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getAllCompanyGoals, getAllPersonalGoals, getActiveTeamMembers, getGoalScale } from '@/lib/db';
import AdminLogin from '@/app/admin/AdminLogin';
import GoalsClient from './GoalsClient';

export default function GoalsPage() {
  if (!isAdminAuthenticated()) {
    return <AdminLogin />;
  }

  const companyGoals = getAllCompanyGoals();
  const personalGoals = getAllPersonalGoals();
  const members = getActiveTeamMembers();
  const goalScale = getGoalScale();

  return (
    <GoalsClient
      companyGoals={companyGoals}
      personalGoals={personalGoals}
      members={members}
      goalScale={goalScale}
    />
  );
}
