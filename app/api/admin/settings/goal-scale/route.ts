import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getGoalScale, setGoalScale, type GoalScale } from '@/lib/db';

export async function GET() {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ scale: getGoalScale() });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { scale?: string };
  if (body.scale !== 'rating_5' && body.scale !== 'percent_100') {
    return NextResponse.json({ error: 'scale must be rating_5 or percent_100' }, { status: 400 });
  }
  setGoalScale(body.scale as GoalScale);
  return NextResponse.json({ ok: true });
}
