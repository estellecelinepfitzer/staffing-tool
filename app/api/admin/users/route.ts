import { NextRequest, NextResponse } from 'next/server';
import { getAllMembers, addMember, setMemberActive, updateMember, getMemberByToken } from '@/lib/db';
import { sendWelcome } from '@/lib/email';
import { randomBytes } from 'crypto';

function checkAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-password');
  const expected = process.env.ADMIN_PASSWORD;
  return !!expected && auth === expected;
}

// GET /api/admin/users — list all members
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ members: getAllMembers() });
}

// POST /api/admin/users — add a new member
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name  = typeof body.name  === 'string' ? body.name.trim()  : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
  }

  // Auto-generate token from name: firstname-XXX
  const parts = name.toLowerCase().split(/\s+/);
  const first = parts[0].slice(0, 8);
  const last  = parts[parts.length - 1].slice(0, 3);
  const token = `${first}-${last}`;

  // Generate a random temporary password
  const tempPassword = randomBytes(4).toString('hex');

  addMember(token, name, email);

  const baseUrl = req.nextUrl.origin;
  await sendWelcome({
    to:           email,
    firstName:    parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
    checkinUrl:   `${baseUrl}/checkin?token=${token}`,
    tempPassword,
  });

  return NextResponse.json({ ok: true, token, tempPassword });
}

// PATCH /api/admin/users — update name/email or toggle active
export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  if (typeof body.active === 'boolean') {
    setMemberActive(token, body.active);
  }
  if (typeof body.name === 'string' && typeof body.email === 'string') {
    updateMember(token, body.name.trim(), body.email.trim().toLowerCase());
  }

  return NextResponse.json({ ok: true });
}

// POST /api/admin/users/reset — send a password reset email
// (handled separately via /api/admin/reset-code but also available here)
export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const token = searchParams.get('token') ?? '';
  const member = token ? getMemberByToken(token) : undefined;

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  setMemberActive(token, false);
  return NextResponse.json({ ok: true });
}
