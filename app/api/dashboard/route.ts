import { NextRequest, NextResponse } from 'next/server';
import { getAllMembers, getWeekCheckins } from '@/lib/db';
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

  const members = getAllMembers().filter((m) => m.active === 1);
  const checkins = getWeekCheckins(week, year);
  const checkinByToken = new Map(checkins.map((c) => [c.member_token, c]));

  const team = members.map((member) => ({
    name:    member.name,
    token:   member.token,
    checkin: checkinByToken.get(member.token) ?? null,
  }));

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
    { week, year, team, submittedCount: checkins.length, totalCount: members.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
