import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { reorderQuestions } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params: _params }: { params: { cycleId: string } },
) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { updates: { id: number; sort_order: number }[] };
  if (!Array.isArray(body.updates)) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 });
  }

  reorderQuestions(body.updates);
  return NextResponse.json({ ok: true });
}
