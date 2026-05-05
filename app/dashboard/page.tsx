import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME, COOKIE_NAME } from '@/lib/auth';
import { getTeamMember } from '@/lib/db';
import DashboardClient from './DashboardClient';
import DashboardPasswordGate from './DashboardPasswordGate';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const cookieStore = cookies();

  // Check personal session first — any logged-in user can access the dashboard
  let isAdmin = false;
  const userSession = cookieStore.get(COOKIE_NAME);
  if (userSession) {
    const memberToken = verifySignedToken(userSession.value);
    if (memberToken) {
      const member = getTeamMember(memberToken);
      if (member) {
        // Valid personal session → grant dashboard access
        isAdmin = member.role === 'admin';
        return (
          <Suspense fallback={<LoadingScreen />}>
            <DashboardClient isAdmin={isAdmin} />
          </Suspense>
        );
      }
    }
  }

  // Fall back to legacy shared dashboard password
  const session = cookieStore.get(DASHBOARD_COOKIE_NAME);
  const verified = session ? verifySignedToken(session.value) : null;
  if (verified !== 'dashboard') {
    return <DashboardPasswordGate />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardClient isAdmin={false} />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  );
}
