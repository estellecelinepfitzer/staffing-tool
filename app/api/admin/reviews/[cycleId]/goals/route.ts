import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { getCycle, getCycleGoals, createGoal } from '@/lib/db';


export async function GET(
  request: NextRequest,
  { params }: { params: { cycleId: string } },
) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycleId = parseInt(params.cycleId, 10);
  const subject = request.nextUrl.searchParams.get('subject');
  if (!subject) return NextResponse.json({ error: 'subject required' }, { status: 400 });

  const goals = getCycleGoals(cycleId, subject);
  return NextResponse.json({ goals });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { cycleId: string } },
) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycleId = parseInt(params.cycleId, 10);
  const cycle = getCycle(cycleId);
  if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json() as { subject_token: string; body: string };
  if (!body.subject_token || !body.body) {
    return NextResponse.json({ error: 'subject_token and body required' }, { status: 400 });
  }

  const id = createGoal(cycleId, body.subject_token, body.body);
  return NextResponse.json({ id, ok: true });
}
