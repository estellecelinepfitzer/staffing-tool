import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { getTeamMember, getDb } from '@/lib/db';

export async function GET() {
  const cookieStore = cookies();

  const session = cookieStore.get(COOKIE_NAME);
  const memberToken = session ? verifySignedToken(session.value) : null;
  const member = memberToken ? getTeamMember(memberToken) : null;

  const dashSession = cookieStore.get(DASHBOARD_COOKIE_NAME);
  const dashVerified = dashSession ? verifySignedToken(dashSession.value) : null;

  // Count admins in DB
  const adminCount = (getDb().prepare("SELECT COUNT(*) as n FROM team_members WHERE role = 'admin'").get() as { n: number }).n;
  const admins = getDb().prepare("SELECT token, name, email, role FROM team_members WHERE role = 'admin'").all();

  return NextResponse.json({
    checkin_cookie_present: !!session,
    member_token: memberToken,
    member: member ? { token: member.token, name: member.name, email: member.email, role: member.role } : null,
    dashboard_cookie_verified: dashVerified,
    admin_count_in_db: adminCount,
    admins_in_db: admins,
  });
}
