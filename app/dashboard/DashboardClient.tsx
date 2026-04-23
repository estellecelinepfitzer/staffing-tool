'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getISOWeek, formatWeekLabel, getPrevWeek, getNextWeek, type ISOWeek } from '@/lib/weeks';

// ─── API response types ───────────────────────────────────────────────────────

interface CheckinData {
  mood: number;
  capacity: number;
  sourcing: string;
  converting: string;
  execution: string;
  portfolio_exits: string;
  portfolio_other: string;
  working_days: number;
  sourcing_days: number;
  converting_days: number;
  execution_days: number;
  portfolio_exits_days: number;
  portfolio_other_days: number;
  submitted_at: string;
}

interface MemberRow {
  name: string;
  token: string;
  checkin: CheckinData | null;
}

interface DashboardData {
  week: number;
  year: number;
  team: MemberRow[];
  submittedCount: number;
  totalCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAPACITY_LABELS: Record<number, string> = {
  1: 'Vacation',
  2: 'Significant capacity',
  3: 'Some capacity',
  4: 'Fully staffed',
  5: 'Crunch',
};

const COLUMNS = [
  { key: 'sourcing',        label: 'Sourcing',   sub: 'IC0',        dayKey: 'sourcing_days'        },
  { key: 'converting',      label: 'Converting', sub: 'IC1',        dayKey: 'converting_days'      },
  { key: 'execution',       label: 'Execution',  sub: 'IC2–3',      dayKey: 'execution_days'       },
  { key: 'portfolio_exits', label: 'Portfolio',  sub: 'Exits',      dayKey: 'portfolio_exits_days' },
  { key: 'portfolio_other', label: 'Portfolio',  sub: 'Other',      dayKey: 'portfolio_other_days' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function moodDot(score: number): string {
  if (score <= 2) return 'bg-red-400';
  if (score === 3) return 'bg-amber-400';
  return 'bg-green-400';
}

function capacityClass(score: number): string {
  if (score === 1) return 'text-gray-400 bg-gray-50 border-gray-200';
  if (score <= 3)  return 'text-green-700 bg-green-50 border-green-200';
  if (score === 4) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function formatDays(v: number): string {
  return v % 1 === 0 ? String(v) : String(v);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient() {
  const now = new Date();
  const [currentWeek, setCurrentWeek] = useState<ISOWeek>(() => getISOWeek(now));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (week: ISOWeek) => {
    try {
      const res = await fetch(`/api/dashboard?week=${week.week}&year=${week.year}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const json: DashboardData = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch {
      // silently ignore — keeps showing stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData(currentWeek);
  }, [currentWeek, fetchData]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchData(currentWeek), 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentWeek, fetchData]);

  const prevWeek = getPrevWeek(currentWeek.week, currentWeek.year);
  const nextWeek = getNextWeek(currentWeek.week, currentWeek.year);
  const currentLabel = formatWeekLabel(currentWeek.week, currentWeek.year);
  const nowWeek = getISOWeek(new Date());
  const isCurrentWeek = currentWeek.week === nowWeek.week && currentWeek.year === nowWeek.year;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">

            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setCurrentWeek(prevWeek)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Previous week"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-sm font-semibold text-gray-900 truncate">{currentLabel}</h1>
              <button
                onClick={() => setCurrentWeek(nextWeek)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Next week"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {!isCurrentWeek && (
                <button
                  onClick={() => setCurrentWeek(getISOWeek(new Date()))}
                  className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors ml-1"
                >
                  Today
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {data && (
                <span className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{data.submittedCount}</span>
                  <span className="text-gray-400"> / {data.totalCount} submitted</span>
                </span>
              )}
              {lastRefresh && (
                <span className="hidden sm:inline text-xs text-gray-300">Refreshes every 60s</span>
              )}
              <a
                href="/admin"
                className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors"
              >
                Admin
              </a>
              <button
                onClick={() => fetchData(currentWeek)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Refresh now"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="px-4 sm:px-6 py-6 overflow-x-auto">
        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : data ? (
          <table className="w-full border-collapse bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-40 min-w-[140px]">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-36 min-w-[130px]">
                  Capacity
                </th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider min-w-[160px]">
                    {col.label}
                    <span className="font-normal text-gray-400 normal-case tracking-normal ml-1">— {col.sub}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.team.map((member) => (
                <TeamRow key={member.token} member={member} week={data.week} year={data.year} />
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function TeamRow({ member, week, year }: { member: MemberRow; week: number; year: number }) {
  const { checkin } = member;
  const firstName = member.name.split(' ')[0];
  const nowWeek = getISOWeek(new Date());
  const isCurrentWeek = week === nowWeek.week && year === nowWeek.year;
  const checkinHref = isCurrentWeek
    ? `/checkin?token=${member.token}`
    : `/checkin?token=${member.token}&week=${week}&year=${year}`;

  return (
    <tr className={`align-top ${!checkin ? 'opacity-50' : ''}`}>

      {/* Name + mood */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {checkin && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${moodDot(checkin.mood)}`} title={`Mood: ${checkin.mood}`} />
          )}
          <a
            href={checkinHref}
            className="font-medium text-gray-900 hover:underline"
            title="Open check-in form"
          >
            {firstName}
          </a>
        </div>
        {checkin ? (
          <p className="text-xs text-gray-400 mt-0.5 ml-4">
            {checkin.working_days}d this week
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">Not submitted</p>
        )}
      </td>

      {/* Capacity */}
      <td className="px-4 py-3">
        {checkin ? (
          <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-0.5 ${capacityClass(checkin.capacity)}`}>
            {CAPACITY_LABELS[checkin.capacity]}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Bucket columns */}
      {COLUMNS.map((col) => {
        const text = checkin ? (checkin[col.key as keyof CheckinData] as string) : '';
        const days = checkin ? (checkin[col.dayKey as keyof CheckinData] as number) : 0;
        const workingDays = checkin?.working_days ?? 0;
        const hasText = !!text?.trim();
        const hasDays = checkin && workingDays > 0;

        return (
          <td key={col.key} className="px-4 py-3">
            {checkin ? (
              <div className="space-y-1">
                {hasDays && (
                  <p className="text-xs font-medium text-gray-500">
                    {formatDays(days)}
                    <span className="text-gray-300 font-normal"> / {workingDays}d</span>
                  </p>
                )}
                {hasText ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>
                ) : (
                  <p className="text-sm text-gray-300">—</p>
                )}
              </div>
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </td>
        );
      })}

    </tr>
  );
}
