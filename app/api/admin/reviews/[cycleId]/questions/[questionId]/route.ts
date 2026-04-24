import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { getCycle, updateQuestion, deleteQuestion } from '@/lib/db';

function isAdmin() {
  const c = cookies().get(DASHBOARD_COOKIE_NAME);
  return c ? verifySignedToken(c.value) === 'dashboard' : false;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { cycleId: string; questionId: string } },
) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycleId = parseInt(params.cycleId, 10);
  const cycle = getCycle(cycleId);
  if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (cycle.status !== 'draft') {
    return NextResponse.json({ error: 'Questions can only be edited in draft status' }, { status: 403 });
  }

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
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycleId = parseInt(params.cycleId, 10);
  const cycle = getCycle(cycleId);
  if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (cycle.status !== 'draft') {
    return NextResponse.json({ error: 'Questions can only be edited in draft status' }, { status: 403 });
  }

  const questionId = parseInt(params.questionId, 10);
  if (isNaN(questionId)) return NextResponse.json({ error: 'Invalid questionId' }, { status: 400 });

  deleteQuestion(questionId);
  return NextResponse.json({ ok: true });
}
