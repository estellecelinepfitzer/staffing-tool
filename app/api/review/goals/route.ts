import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getCycleGoals } from '@/lib/db';

export async function GET(request: NextRequest) {
  const cycleIdStr = request.nextUrl.searchParams.get('cycle');
  const token = request.nextUrl.searchParams.get('token');

  if (!cycleIdStr || !token) {
    return NextResponse.json({ error: 'cycle and token required' }, { status: 400 });
  }

  // Verify cookie matches the requested token
  const c = cookies().get(COOKIE_NAME);
  const authenticatedToken = c ? verifySignedToken(c.value) : null;
  if (authenticatedToken !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cycleId = parseInt(cycleIdStr, 10);
  if (isNaN(cycleId)) return NextResponse.json({ error: 'Invalid cycle' }, { status: 400 });

  const goals = getCycleGoals(cycleId, token);
  return NextResponse.json({ goals });
}
