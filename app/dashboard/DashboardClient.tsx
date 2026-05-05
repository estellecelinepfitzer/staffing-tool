'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getISOWeek, formatWeekLabel, getPrevWeek, getNextWeek, type ISOWeek } from '@/lib/weeks';

// ─── API response types ───────────────────────────────────────────────────────

interface CategoryResponse {
  category_id: number;
  category_label: string;
  days: number;
  notes: string;
}

interface Category {
  id: number;
  label: string;
  sort_order: number;
}

interface CheckinData {
  mood: number;
  capacity: number;
  working_days: number;
  submitted_at: string;
  category_responses: CategoryResponse[];
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
  categories: Category[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAPACITY_LABELS: Record<number, string> = {
  1: 'Vacation',
  2: 'Significant capacity',
  3: 'Some capacity',
  4: 'Fully staffed',
  5: 'Crunch',
};

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({ isAdmin = false }: { isAdmin?: boolean }) {
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

  function downloadCsv() {
    if (!data) return;
    window.location.href = `/api/dashboard/csv?week=${data.week}&year=${data.year}`;
  }

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

            <div className="flex items-center gap-4 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mtip-logo.png" alt="MTIP" className="h-7 w-auto shrink-0" />
              <div className="flex items-center gap-2">
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
              <button
                onClick={downloadCsv}
                disabled={!data}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                title="Download CSV for this week"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              {isAdmin && (
                <a
                  href="/admin"
                  className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors"
                >
                  Admin
                </a>
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
                {data.categories.map((cat) => (
                  <th key={cat.id} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider min-w-[160px]">
                    {cat.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.team.map((member) => (
                <TeamRow key={member.token} member={member} week={data.week} year={data.year} categories={data.categories} />
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function TeamRow({ member, week, year, categories }: { member: MemberRow; week: number; year: number; categories: Category[] }) {
  const { checkin } = member;
  const firstName = member.name.split(' ')[0];
  const checkinHref = `/my-reviews?token=${member.token}&week=${week}&year=${year}`;

  return (
    <tr className={`align-top ${!checkin ? 'opacity-50' : ''}`}>

      {/* Name + mood */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {checkin && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${moodDot(checkin.mood)}`} title={`Mood: ${checkin.mood}`} />
          )}
          <a href={checkinHref} className="font-medium text-gray-900 hover:underline" title="Open personal portal">
            {firstName}
          </a>
        </div>
        {checkin ? (
          <p className="text-xs text-gray-400 mt-0.5 ml-4">{checkin.working_days}d this week</p>
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

      {/* Per-category columns */}
      {categories.map((cat) => {
        const resp = checkin?.category_responses.find((r) => r.category_id === cat.id);
        const hasText = !!resp?.notes?.trim();
        const hasDays = checkin && checkin.working_days > 0;

        return (
          <td key={cat.id} className="px-4 py-3">
            {checkin ? (
              <div className="space-y-1">
                {hasDays && resp && (
                  <p className="text-xs font-medium text-gray-500">
                    {resp.days}
                    <span className="text-gray-300 font-normal"> / {checkin.working_days}d</span>
                  </p>
                )}
                {hasText ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{resp!.notes}</p>
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
