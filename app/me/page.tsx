export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getCheckin,
  getAllCycles,
  getAssignmentByKey,
  getMemberGoalsExtended,
} from '@/lib/db';
import { getISOWeek } from '@/lib/weeks';
import LogoutButton from './LogoutButton';

export default function MePage() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const memberToken = session ? verifySignedToken(session.value) : null;

  if (!memberToken) redirect('/login');

  const member = getTeamMember(memberToken);
  if (!member) redirect('/login');

  const now = new Date();
  const { week, year } = getISOWeek(now);
  const checkin = getCheckin(memberToken, week, year);

  // Find an open review cycle with an assignment for this member
  const cycles = getAllCycles();
  const openCycle = cycles.find((c) =>
    c.status === 'self_review_open' ||
    c.status === 'peer_review_open' ||
    c.status === 'manager_review_open',
  );
  const selfAssignment = openCycle
    ? getAssignmentByKey(openCycle.id, memberToken, memberToken, 'self')
    : null;

  // Manager: any direct reports with open manager assignments
  const managerAssignments = openCycle
    ? cycles
        .filter((c) => c.status === 'manager_review_open')
        .flatMap((c) => {
          // We just check if there's at least one — shown as a card
          return [];
        })
    : [];

  const goals = getMemberGoalsExtended(memberToken);
  const firstName = member.name.split(' ')[0];
  const isAdmin = member.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/mtip-logo.png" alt="MTIP" width={56} height={22} className="object-contain" />
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <a
                href="/admin"
                className="rounded-lg bg-brand-blue text-white px-3 py-1.5 text-xs font-medium hover:bg-[#006BB0] transition-colors"
              >
                Admin
              </a>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Personal</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Hello, {firstName}</h1>

        <div className="space-y-4">

          {/* Weekly check-in */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-0.5">Weekly check-in</p>
                <p className="text-xs text-gray-500">
                  {checkin
                    ? 'Submitted for this week'
                    : 'Not yet submitted this week'}
                </p>
              </div>
              <a
                href={`/checkin?token=${memberToken}`}
                className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {checkin ? 'View / edit' : 'Fill in'}
              </a>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-0.5">My goals</p>
                <p className="text-xs text-gray-500">
                  {goals.length === 0
                    ? 'No goals set yet'
                    : `${goals.length} goal${goals.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <a
                href="/goals"
                className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                View goals
              </a>
            </div>
          </div>

          {/* Self-review */}
          {openCycle && selfAssignment && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-0.5">Self-review</p>
                  <p className="text-xs text-gray-500">
                    {openCycle.name} ·{' '}
                    {selfAssignment.status === 'submitted' ? 'Submitted' : 'In progress'}
                  </p>
                </div>
                <a
                  href={`/review/self?cycle=${openCycle.id}&token=${memberToken}`}
                  className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {selfAssignment.status === 'submitted' ? 'View' : 'Fill in'}
                </a>
              </div>
            </div>
          )}

          {/* My reviews page */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-0.5">All my reviews</p>
                <p className="text-xs text-gray-500">Peer reviews, manager reviews &amp; history</p>
              </div>
              <a
                href={`/my-reviews?token=${memberToken}`}
                className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                View
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
