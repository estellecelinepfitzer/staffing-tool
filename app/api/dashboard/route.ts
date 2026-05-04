import { NextRequest, NextResponse } from 'next/server';
import { getCheckinMembers, getWeekCheckins, getActiveCategories, getCheckinResponsesForWeek } from '@/lib/db';
import { getISOWeek } from '@/lib/weeks';

// GET /api/dashboard?week=17&year=2026
// Returns all active team members with their check-in for the given week.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const weekParam = searchParams.get('week');
  const yearParam = searchParams.get('year');

  const fallback = getISOWeek(new Date());
  const week = weekParam ? parseInt(weekParam, 10) : fallback.week;
  const year = yearParam ? parseInt(yearParam, 10) : fallback.year;

  const members = getCheckinMembers();
  const checkins = getWeekCheckins(week, year);
  const categories = getActiveCategories();
  const allResponses = getCheckinResponsesForWeek(week, year);

  // Group responses by checkin_id
  const responsesByCheckin = new Map<number, typeof allResponses>();
  for (const r of allResponses) {
    if (!responsesByCheckin.has(r.checkin_id)) responsesByCheckin.set(r.checkin_id, []);
    responsesByCheckin.get(r.checkin_id)!.push(r);
  }

  const checkinByToken = new Map(checkins.map((c) => [c.member_token, c]));

  const team = members.map((member) => {
    const checkin = checkinByToken.get(member.token) ?? null;
    return {
      name:    member.name,
      token:   member.token,
      checkin: checkin ? {
        ...checkin,
        category_responses: responsesByCheckin.get(checkin.id) ?? [],
      } : null,
    };
  });

  team.sort((a, b) => {
    if (a.checkin && !b.checkin) return -1;
    if (!a.checkin && b.checkin) return 1;
    if (a.checkin && b.checkin) {
      return (
        new Date(a.checkin.submitted_at).getTime() -
        new Date(b.checkin.submitted_at).getTime()
      );
    }
    return 0;
  });

  return NextResponse.json(
    { week, year, team, submittedCount: checkins.length, totalCount: members.length, categories },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
