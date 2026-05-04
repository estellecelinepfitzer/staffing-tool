import { NextRequest, NextResponse } from 'next/server';
import { getMemberByToken, getCheckin, upsertCheckin, getCheckinResponses, upsertCheckinResponse, getActiveCategories } from '@/lib/db';
import { getISOWeek, getISOWeekDateRange } from '@/lib/weeks';

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
  if (!checkin) return NextResponse.json({ checkin: null });
  const responses = getCheckinResponses(checkin.id);
  return NextResponse.json({ checkin: { ...checkin, category_responses: responses } });
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
  const currentIso = getISOWeek(now);
  const weekRaw = body.week !== undefined ? Number(body.week) : NaN;
  const yearRaw = body.year !== undefined ? Number(body.year) : NaN;
  const week = isFinite(weekRaw) && weekRaw > 0 ? weekRaw : currentIso.week;
  const year = isFinite(yearRaw) && yearRaw > 0 ? yearRaw : currentIso.year;

  // Reject writes to past ISO weeks
  const { end: weekEnd } = getISOWeekDateRange(week, year);
  const nowDate = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (nowDate > weekEnd.getTime()) {
    return NextResponse.json({ error: 'This week is closed. Submissions can only be edited during the active week.' }, { status: 403 });
  }

  const toNum = (v: unknown, fallback = 0) => {
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  };

  // category_responses: [{category_id, days, notes}]
  const categoryResponses = Array.isArray(body.category_responses)
    ? (body.category_responses as Array<{ category_id: number; days: number; notes: string }>)
    : [];

  // Also accept legacy flat fields for backward compat (old-format submits)
  const legacyFieldMap: Record<number, { notes: string; days: number }> = {
    1: { notes: typeof body.sourcing        === 'string' ? body.sourcing        : '', days: toNum(body.sourcing_days) },
    2: { notes: typeof body.converting      === 'string' ? body.converting      : '', days: toNum(body.converting_days) },
    3: { notes: typeof body.execution       === 'string' ? body.execution       : '', days: toNum(body.execution_days) },
    4: { notes: typeof body.portfolio_exits === 'string' ? body.portfolio_exits : '', days: toNum(body.portfolio_exits_days) },
    5: { notes: typeof body.portfolio_other === 'string' ? body.portfolio_other : '', days: toNum(body.portfolio_other_days) },
  };

  // Build first-class sourcing/converting/etc. columns from category_responses (keep backward compat)
  const catResp = categoryResponses.length > 0 ? categoryResponses : [];
  const getField = (id: number, field: 'notes' | 'days') => {
    const fromNew = catResp.find((r) => r.category_id === id);
    if (fromNew) return field === 'notes' ? fromNew.notes : fromNew.days;
    return field === 'notes' ? legacyFieldMap[id]?.notes ?? '' : legacyFieldMap[id]?.days ?? 0;
  };

  const checkinId = upsertCheckin({
    member_token:         token,
    member_name:          member.name,
    iso_week:             week,
    iso_year:             year,
    submitted_at:         now.toISOString(),
    mood,
    capacity,
    sourcing:             getField(1, 'notes') as string,
    converting:           getField(2, 'notes') as string,
    execution:            getField(3, 'notes') as string,
    portfolio_exits:      getField(4, 'notes') as string,
    portfolio_other:      getField(5, 'notes') as string,
    working_days:         toNum(body.working_days),
    sourcing_days:        getField(1, 'days') as number,
    converting_days:      getField(2, 'days') as number,
    execution_days:       getField(3, 'days') as number,
    portfolio_exits_days: getField(4, 'days') as number,
    portfolio_other_days: getField(5, 'days') as number,
  });

  // Save per-category responses
  if (categoryResponses.length > 0) {
    const activeCategories = getActiveCategories();
    const catMap = new Map(activeCategories.map((c) => [c.id, c.label]));
    for (const cr of categoryResponses) {
      const label = catMap.get(cr.category_id);
      if (!label) continue;
      upsertCheckinResponse(checkinId, cr.category_id, label, toNum(cr.days), typeof cr.notes === 'string' ? cr.notes : '');
    }
  } else {
    // Legacy: ensure checkin_responses rows exist for the 5 original categories
    const legacyLabels: Record<number, string> = { 1: 'Sourcing', 2: 'Converting', 3: 'Execution', 4: 'Portfolio Exits', 5: 'Portfolio Other' };
    for (const [id, lbl] of Object.entries(legacyLabels)) {
      const numId = Number(id);
      upsertCheckinResponse(checkinId, numId, lbl, legacyFieldMap[numId]?.days ?? 0, legacyFieldMap[numId]?.notes ?? '');
    }
  }

  return NextResponse.json({ ok: true });
}
