import { NextRequest, NextResponse } from 'next/server';
import { getCycleQuestions } from '@/lib/db';

// Questions are not sensitive — no auth needed
export async function GET(request: NextRequest) {
  const cycleIdStr = request.nextUrl.searchParams.get('cycle');
  const type = request.nextUrl.searchParams.get('type');

  if (!cycleIdStr || !type) {
    return NextResponse.json({ error: 'cycle and type required' }, { status: 400 });
  }

  const cycleId = parseInt(cycleIdStr, 10);
  if (isNaN(cycleId)) return NextResponse.json({ error: 'Invalid cycle' }, { status: 400 });

  const questions = getCycleQuestions(cycleId, type);
  return NextResponse.json({ questions });
}
