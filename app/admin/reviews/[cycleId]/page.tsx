export const dynamic = 'force-dynamic';

import { isAdminAuthenticated } from '@/lib/adminAuth';
import {
  getCycle,
  getActiveTeamMembers,
  getCycleAssignments,
  getCycleSignoffs,
  getCycleQuestions,
} from '@/lib/db';
import DashboardPasswordGate from '@/app/dashboard/DashboardPasswordGate';
import CycleClient from './CycleClient';
import { notFound } from 'next/navigation';

interface Props {
  params: { cycleId: string };
}

export default function CyclePage({ params }: Props) {
  if (!isAdminAuthenticated()) {
    return <DashboardPasswordGate />;
  }

  const cycleId = parseInt(params.cycleId, 10);
  if (isNaN(cycleId)) notFound();

  const cycle = getCycle(cycleId);
  if (!cycle) notFound();

  const members = getActiveTeamMembers();
  const assignments = getCycleAssignments(cycleId);
  const signoffs = getCycleSignoffs(cycleId);
  const selfQuestions = getCycleQuestions(cycleId, 'self');
  const peerQuestions = getCycleQuestions(cycleId, 'peer');
  const managerQuestions = getCycleQuestions(cycleId, 'manager');

  return (
    <CycleClient
      cycle={cycle}
      members={members}
      assignments={assignments}
      signoffs={signoffs}
      selfQuestions={selfQuestions}
      peerQuestions={peerQuestions}
      managerQuestions={managerQuestions}
    />
  );
}
