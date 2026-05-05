import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { createCycle, getAllCycles, seedQuestionsForCycle } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (!isAdminRequest()) {
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

  // Seed from the most recent previous cycle (any status) so deletions propagate
  const allCycles = getAllCycles();
  const previousCycle = allCycles.find((c) => c.id !== id);
  seedQuestionsForCycle(id, previousCycle?.id ?? null);

  return NextResponse.json({ id, ok: true });
}
