import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getSharedWithMember } from '@/lib/db';

export async function GET() {
  const c = cookies().get(COOKIE_NAME);
  const token = c ? verifySignedToken(c.value) : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const shared = getSharedWithMember(token);
  return NextResponse.json({ shared });
}
