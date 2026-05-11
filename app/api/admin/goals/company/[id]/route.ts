import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { updateCompanyGoal, deleteCompanyGoal } from '@/lib/db';

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = parseInt(params.id, 10);
  const body = await req.json() as { title?: string; description?: string; sort_order?: number; scale?: string; timeline?: string };
  updateCompanyGoal(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  deleteCompanyGoal(parseInt(params.id, 10));
  return NextResponse.json({ ok: true });
}
