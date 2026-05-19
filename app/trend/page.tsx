import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySignedToken, COOKIE_NAME, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import TrendClient from './TrendClient';

export const dynamic = 'force-dynamic';

export default function TrendPage() {
  const cookieStore = cookies();

  const userSession = cookieStore.get(COOKIE_NAME);
  const memberToken = userSession ? verifySignedToken(userSession.value) : null;

  if (!memberToken) {
    const dashSession = cookieStore.get(DASHBOARD_COOKIE_NAME);
    const verified = dashSession ? verifySignedToken(dashSession.value) : null;
    if (verified !== 'dashboard') {
      redirect('/dashboard');
    }
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></div>}>
      <TrendClient />
    </Suspense>
  );
}
