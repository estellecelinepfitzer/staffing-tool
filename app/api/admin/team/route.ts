import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { upsertTeamMember, getTeamMember } from '@/lib/db';

// POST /api/admin/team — add a new team member
export async function POST(req: NextRequest) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as {
    token?: string;
    name?: string;
    email?: string;
    password?: string;
  };

  const token    = typeof body.token    === 'string' ? body.token.trim()    : '';
  const name     = typeof body.name     === 'string' ? body.name.trim()     : '';
  const email    = typeof body.email    === 'string' ? body.email.trim()    : '';
  const password = typeof body.password === 'string' ? body.password.trim() : '';

  if (!token || !name || !email || !password) {
    return NextResponse.json({ error: 'token, name, email and password are required' }, { status: 400 });
  }

  upsertTeamMember({ token, name, email, password, manager_token: '', checkin: 1, role: 'member' });
  const member = getTeamMember(token);
  return NextResponse.json({ member });
}
