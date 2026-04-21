import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { createCycle } from '@/lib/db';

function isAdmin() {
  const c = cookies().get(DASHBOARD_COOKIE_NAME);
  return c ? verifySignedToken(c.value) === 'dashboard' : false;
}

export async function POST(request: NextRequest) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    name: string;
    self_due?: string;
    peer_due?: string;
    manager_due?: string;
  };

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const id = createCycle({
    name: body.name,
    status: 'draft',
    self_due: body.self_due ?? null,
    peer_due: body.peer_due ?? null,
    manager_due: body.manager_due ?? null,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ id, ok: true });
}
