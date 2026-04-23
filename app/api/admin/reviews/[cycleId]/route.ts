import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { getCycle, updateCycle, deleteCycle } from '@/lib/db';

function isAdmin() {
  const c = cookies().get(DASHBOARD_COOKIE_NAME);
  return c ? verifySignedToken(c.value) === 'dashboard' : false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { cycleId: string } },
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cycleId = parseInt(params.cycleId, 10);
  const cycle = getCycle(cycleId);
  if (!cycle) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(cycle);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { cycleId: string } },
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cycleId = parseInt(params.cycleId, 10);
  const body = await request.json() as {
    name?: string;
    self_due?: string | null;
    peer_due?: string | null;
    manager_due?: string | null;
  };

  updateCycle(cycleId, {
    name: body.name,
    self_due: body.self_due ?? undefined,
    peer_due: body.peer_due ?? undefined,
    manager_due: body.manager_due ?? undefined,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { cycleId: string } },
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cycleId = parseInt(params.cycleId, 10);
  const cycle = getCycle(cycleId);
  if (!cycle) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  deleteCycle(cycleId);
  return NextResponse.json({ ok: true });
}
