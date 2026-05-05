import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { getCycle, getCycleQuestions, createQuestion } from '@/lib/db';


export async function GET(
  request: NextRequest,
  { params }: { params: { cycleId: string } },
) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycleId = parseInt(params.cycleId, 10);
  const type = request.nextUrl.searchParams.get('type');
  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 });

  const questions = getCycleQuestions(cycleId, type);
  return NextResponse.json({ questions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { cycleId: string } },
) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycleId = parseInt(params.cycleId, 10);
  const cycle = getCycle(cycleId);
  if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (cycle.status !== 'draft') {
    return NextResponse.json({ error: 'Questions can only be edited in draft status' }, { status: 403 });
  }

  const body = await request.json() as {
    review_type: string;
    question_text: string;
    question_type?: string;
    placeholder?: string;
    required?: number;
    sort_order?: number;
  };

  if (!body.review_type || !body.question_text) {
    return NextResponse.json({ error: 'review_type and question_text required' }, { status: 400 });
  }

  // Generate a unique key from text
  const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const id = createQuestion({
    cycle_id: cycleId,
    review_type: body.review_type,
    question_key: key,
    question_text: body.question_text,
    question_type: body.question_type ?? 'text',
    placeholder: body.placeholder ?? null,
    required: body.required ?? 1,
    sort_order: body.sort_order ?? 999,
  });

  return NextResponse.json({ id, ok: true });
}
