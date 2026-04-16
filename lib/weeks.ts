// Pure ISO-8601 week utilities — safe to import in both server and client code.

export interface ISOWeek {
  week: number;
  year: number;
}

/** Return the ISO week number and year for a given date. */
export function getISOWeek(date: Date): ISOWeek {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1 = Mon … 7 = Sun
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/** Return the UTC Monday (start) and Sunday (end) dates for an ISO week. */
export function getISOWeekDateRange(week: number, year: number): { start: Date; end: Date } {
  // Jan 4 is always in week 1 per ISO 8601
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfJan4 = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (dayOfJan4 - 1));

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return { start, end };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Week 17 — Apr 14–20, 2026" */
export function formatWeekLabel(week: number, year: number): string {
  const { start, end } = getISOWeekDateRange(week, year);
  const s = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const e = `${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `Week ${week} — ${s}–${e}, ${year}`;
}

export function getPrevWeek(week: number, year: number): ISOWeek {
  if (week === 1) {
    // Last week of the previous year — Dec 28 is always in the last ISO week
    return getISOWeek(new Date(Date.UTC(year - 1, 11, 28)));
  }
  return { week: week - 1, year };
}

export function getNextWeek(week: number, year: number): ISOWeek {
  const { start } = getISOWeekDateRange(week, year);
  const nextMonday = new Date(start);
  nextMonday.setUTCDate(start.getUTCDate() + 7);
  return getISOWeek(nextMonday);
}
