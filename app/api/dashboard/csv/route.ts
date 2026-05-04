import { NextRequest, NextResponse } from 'next/server';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getCheckinMembers, getWeekCheckins, getActiveCategories, getCheckinResponsesForWeek } from '@/lib/db';
import { getISOWeek, formatWeekLabel } from '@/lib/weeks';

const MOOD_LABELS: Record<number, string> = { 1: 'Not able to work', 2: 'Not good', 3: 'Fine', 4: 'Good', 5: 'Great' };
const CAPACITY_LABELS: Record<number, string> = { 1: 'Vacation', 2: 'Significant capacity', 3: 'Some capacity', 4: 'Fully staffed', 5: 'Crunch' };

function csvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const session = cookieStore.get(DASHBOARD_COOKIE_NAME);
  if (!session || verifySignedToken(session.value) !== 'dashboard') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const fallback = getISOWeek(new Date());
  const week = searchParams.get('week') ? parseInt(searchParams.get('week')!, 10) : fallback.week;
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : fallback.year;

  const members = getCheckinMembers();
  const checkins = getWeekCheckins(week, year);
  const categories = getActiveCategories();
  const allResponses = getCheckinResponsesForWeek(week, year);

  const responsesByCheckin = new Map<number, typeof allResponses>();
  for (const r of allResponses) {
    if (!responsesByCheckin.has(r.checkin_id)) responsesByCheckin.set(r.checkin_id, []);
    responsesByCheckin.get(r.checkin_id)!.push(r);
  }

  const checkinByToken = new Map(checkins.map((c) => [c.member_token, c]));
  const weekLabel = formatWeekLabel(week, year);

  // Header row
  const headers = [
    'Name', 'Week', 'Mood Score', 'Mood Label', 'Capacity Score', 'Capacity Label',
    ...categories.map((c) => c.label),
  ];

  const rows: string[] = [headers.map(csvCell).join(',')];

  for (const member of members) {
    const checkin = checkinByToken.get(member.token);
    const responses = checkin ? (responsesByCheckin.get(checkin.id) ?? []) : [];
    const catValues = categories.map((cat) => {
      const resp = responses.find((r) => r.category_id === cat.id);
      return resp ? resp.notes : '';
    });

    const row = [
      member.name,
      weekLabel,
      checkin?.mood ?? '',
      checkin ? (MOOD_LABELS[checkin.mood] ?? '') : '',
      checkin?.capacity ?? '',
      checkin ? (CAPACITY_LABELS[checkin.capacity] ?? '') : '',
      ...catValues,
    ];
    rows.push(row.map(csvCell).join(','));
  }

  const csv = rows.join('\r\n');
  const filename = `staffing_week_${week}_${year}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
