import { NextRequest, NextResponse } from 'next/server';
import { getMemberByToken } from '@/lib/db';
import { getCheckin, upsertCheckin } from '@/lib/db';
import { getISOWeek } from '@/lib/weeks';

// GET /api/checkin?token=abc&week=17&year=2026
// Returns the existing check-in for the given token + ISO week (or null).
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get('token')?.trim();

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const member = getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  const weekParam = searchParams.get('week');
  const yearParam = searchParams.get('year');
  const { week, year } =
    weekParam && yearParam
      ? { week: parseInt(weekParam, 10), year: parseInt(yearParam, 10) }
      : getISOWeek(new Date());

  const checkin = getCheckin(token, week, year);
  return NextResponse.json({ checkin: checkin ?? null });
}

// POST /api/checkin — upsert a check-in for the current ISO week
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const member = getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  const mood = Number(body.mood);
  const capacity = Number(body.capacity);

  if (!mood || mood < 1 || mood > 5) {
    return NextResponse.json({ error: 'mood must be 1–5' }, { status: 400 });
  }
  if (!capacity || capacity < 1 || capacity > 5) {
    return NextResponse.json({ error: 'capacity must be 1–5' }, { status: 400 });
  }

  const now = new Date();
  const { week, year } = getISOWeek(now);

  const toNum = (v: unknown, fallback = 0) => {
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  };

  upsertCheckin({
    member_token:         token,
    member_name:          member.name,
    iso_week:             week,
    iso_year:             year,
    submitted_at:         now.toISOString(),
    mood,
    capacity,
    sourcing:             typeof body.sourcing        === 'string' ? body.sourcing        : '',
    converting:           typeof body.converting      === 'string' ? body.converting      : '',
    execution:            typeof body.execution       === 'string' ? body.execution       : '',
    portfolio_exits:      typeof body.portfolio_exits === 'string' ? body.portfolio_exits : '',
    portfolio_other:      typeof body.portfolio_other === 'string' ? body.portfolio_other : '',
    working_days:         toNum(body.working_days),
    sourcing_days:        toNum(body.sourcing_days),
    converting_days:      toNum(body.converting_days),
    execution_days:       toNum(body.execution_days),
    portfolio_exits_days: toNum(body.portfolio_exits_days),
    portfolio_other_days: toNum(body.portfolio_other_days),
  });

  return NextResponse.json({ ok: true });
}
