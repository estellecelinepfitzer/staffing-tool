import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { updateCategoryLabel, updateCategorySortOrder, softDeleteCategory } from '@/lib/db';

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = parseInt(params.id, 10);
  const body = await req.json() as { label?: string; sort_order?: number; active?: number };
  if (body.label !== undefined) updateCategoryLabel(id, body.label.trim());
  if (body.sort_order !== undefined) updateCategorySortOrder(id, body.sort_order);
  if (body.active === 0) softDeleteCategory(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = parseInt(params.id, 10);
  softDeleteCategory(id);
  return NextResponse.json({ ok: true });
}
