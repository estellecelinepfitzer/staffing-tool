import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getAllCategories, createCategory } from '@/lib/db';

export async function GET() {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ categories: getAllCategories() });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { label?: string; sort_order?: number };
  const label = body.label?.trim();
  if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 });
  const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : 999;
  const id = createCategory(label, sortOrder);
  return NextResponse.json({ id });
}
