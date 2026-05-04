import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getAllCompanyGoals, createCompanyGoal } from '@/lib/db';

export async function GET() {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ goals: getAllCompanyGoals() });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { title?: string; description?: string; sort_order?: number };
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  const id = createCompanyGoal(title, body.description?.trim() ?? '', body.sort_order ?? 999);
  return NextResponse.json({ id });
}
