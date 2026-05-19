import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { getYTDTrendByMember, getCheckinMembers, getActiveCategories } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = cookies();

  const userSession = cookieStore.get(COOKIE_NAME);
  const memberToken = userSession ? verifySignedToken(userSession.value) : null;

  if (!memberToken) {
    const dashSession = cookieStore.get(DASHBOARD_COOKIE_NAME);
    const verified = dashSession ? verifySignedToken(dashSession.value) : null;
    if (verified !== 'dashboard') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const rows = getYTDTrendByMember();
  const members = getCheckinMembers();
  const categories = getActiveCategories();

  return NextResponse.json({ rows, members, categories }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
