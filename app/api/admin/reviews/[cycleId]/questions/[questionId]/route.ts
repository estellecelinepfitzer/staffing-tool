import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { getCycle, updateQuestion, deleteQuestion } from '@/lib/db';


export async function PATCH(
  request: NextRequest,
  { params }: { params: { cycleId: string; questionId: string } },
) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycleId = parseInt(params.cycleId, 10);
  const cycle = getCycle(cycleId);
  if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const questionId = parseInt(params.questionId, 10);
  if (isNaN(questionId)) return NextResponse.json({ error: 'Invalid questionId' }, { status: 400 });

  const body = await request.json() as { question_text?: string; placeholder?: string | null; required?: number };
  updateQuestion(questionId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { cycleId: string; questionId: string } },
) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycleId = parseInt(params.cycleId, 10);
  const cycle = getCycle(cycleId);
  if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const questionId = parseInt(params.questionId, 10);
  if (isNaN(questionId)) return NextResponse.json({ error: 'Invalid questionId' }, { status: 400 });

  deleteQuestion(questionId);
  return NextResponse.json({ ok: true });
}
