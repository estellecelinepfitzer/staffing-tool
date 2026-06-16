import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { getSetting, setSetting } from '@/lib/db';

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    monday_digest_enabled: getSetting('monday_digest_enabled') !== 'false',
  });
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json() as { monday_digest_enabled?: boolean };
  if (typeof body.monday_digest_enabled === 'boolean') {
    setSetting('monday_digest_enabled', body.monday_digest_enabled ? 'true' : 'false');
  }
  return NextResponse.json({ ok: true });
}
