import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { getAdminPasswordOverride, setAdminPasswordOverride } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'currentPassword and newPassword required' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const override = getAdminPasswordOverride();
  const expected = override ?? process.env.ADMIN_PASSWORD;

  if (!expected || currentPassword !== expected) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  setAdminPasswordOverride(newPassword);
  return NextResponse.json({ ok: true });
}
