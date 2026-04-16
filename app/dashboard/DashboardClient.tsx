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

// ─── Label maps ───────────────────────────────────────────────────────────────

const MOOD_LABELS: Record<number, string> = {
  1: 'Not able to work',
  2: 'Not good',
  3: 'Fine',
  4: 'Good',
  5: 'Great',
};

const CAPACITY_LABELS: Record<number, string> = {
  1: 'Vacation',
  2: 'Has significant capacity',
  3: 'Has some capacity',
  4: 'Fully staffed with a live deal',
  5: 'Crunch period: execution phase',
};

const DEAL_SECTIONS = [
  { key: 'sourcing',        label: 'Sourcing',   sub: 'IC0 "one-pager"' },
  { key: 'converting',      label: 'Converting', sub: 'IC1 "BC"'        },
  { key: 'execution',       label: 'Execution',  sub: 'IC2-3 "EP/IM"'   },
  { key: 'portfolio_exits', label: 'Portfolio',  sub: 'Exits'           },
  { key: 'portfolio_other', label: 'Portfolio',  sub: 'Other'           },
] as const;

// ─── Badge helpers ────────────────────────────────────────────────────────────

function moodBadgeClass(score: number): string {
  if (score <= 2) return 'bg-red-100 text-red-700 border-red-200';
  if (score === 3) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-green-100 text-green-700 border-green-200';
}

function capacityBadgeClass(score: number): string {
  if (score === 1) return 'bg-gray-100 text-gray-500 border-gray-200';
  if (score <= 3) return 'bg-green-100 text-green-700 border-green-200';
  if (score === 4) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function formatSubmittedAt(isoString: string): string {
  const d = new Date(isoString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `Submitted ${days[d.getDay()]} ${h12}:${m}${ampm}`;
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
      // silently ignore refresh errors — keeps showing stale data
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + re-fetch when week changes
  useEffect(() => {
    setLoading(true);
    fetchData(currentWeek);
  }, [currentWeek, fetchData]);

  // 60-second auto-refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchData(currentWeek), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">

            {/* Week nav */}
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

              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 truncate">{currentLabel}</h1>
              </div>

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

            {/* Status */}
            <div className="flex items-center gap-3 shrink-0">
              {data && (
                <span className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{data.submittedCount}</span>
                  <span className="text-gray-400"> / {data.totalCount} submitted</span>
                </span>
              )}
              {lastRefresh && (
                <span className="hidden sm:inline text-xs text-gray-300">
                  Refreshes every 60s
                </span>
              )}
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

      {/* ── Cards grid ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.team.map((member) => (
              <MemberCard key={member.token} member={member} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({ member }: { member: MemberRow }) {
  const { checkin } = member;

  return (
    <div className={`bg-white rounded-xl border flex flex-col ${checkin ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>

      {/* Card header */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <h2 className="text-sm font-semibold text-gray-900 leading-tight">{member.name}</h2>
        </div>

        {checkin ? (
          <div className="flex flex-wrap gap-2">
            <Badge
              label={`${checkin.mood} — ${MOOD_LABELS[checkin.mood]}`}
              className={moodBadgeClass(checkin.mood)}
              prefix="Mood"
            />
            <Badge
              label={`${checkin.capacity} — ${CAPACITY_LABELS[checkin.capacity]}`}
              className={capacityBadgeClass(checkin.capacity)}
              prefix="Capacity"
            />
          </div>
        ) : (
          <span className="inline-flex items-center text-xs font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-0.5">
            Not yet submitted
          </span>
        )}
      </div>

      {/* Deal sections */}
      <div className="flex-1 divide-y divide-gray-50">
        {DEAL_SECTIONS.map(({ key, label, sub }) => {
          const text = checkin ? checkin[key as keyof CheckinData] as string : '';
          const isEmpty = !text?.trim();

          return (
            <div key={key} className="px-5 py-3">
              <p className="text-xs font-medium text-gray-400 mb-1">
                {label}
                <span className="font-normal"> — {sub}</span>
              </p>
              {isEmpty ? (
                <p className="text-sm text-gray-300">—</p>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100">
        {checkin ? (
          <p className="text-xs text-gray-400">{formatSubmittedAt(checkin.submitted_at)}</p>
        ) : (
          <p className="text-xs text-gray-300">Not yet submitted</p>
        )}
      </div>

    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({
  label,
  className,
  prefix,
}: {
  label: string;
  className: string;
  prefix: string;
}) {
  return (
    <span
      title={prefix}
      className={`inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-0.5 ${className}`}
    >
      {label}
    </span>
  );
}
