'use client';

import { useState, useEffect } from 'react';

interface Category { id: number; label: string; sort_order: number; }
interface Member { token: string; name: string; }
interface TrendRow { member_token: string; member_name: string; category_label: string; total_days: number; }
interface TrendData { rows: TrendRow[]; members: Member[]; categories: Category[]; }

const CATEGORY_COLORS: Record<string, string> = {
  'Sourcing':         'bg-blue-400',
  'Converting':       'bg-violet-400',
  'Execution':        'bg-amber-400',
  'Portfolio Exits':  'bg-emerald-400',
  'Portfolio Other':  'bg-teal-400',
};

function barColor(label: string): string {
  return CATEGORY_COLORS[label] ?? 'bg-gray-400';
}

export default function TrendClient() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trend', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: TrendData) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  const { rows, members, categories } = data;
  const catLabels = categories.map((c) => c.label);

  // ── Totals by category ────────────────────────────────────────────────────
  const totalByCategory: Record<string, number> = {};
  for (const row of rows) {
    totalByCategory[row.category_label] = (totalByCategory[row.category_label] ?? 0) + row.total_days;
  }
  const grandTotal = Object.values(totalByCategory).reduce((s, v) => s + v, 0);
  const maxCatDays = Math.max(...Object.values(totalByCategory), 1);

  // ── Per-member by category ────────────────────────────────────────────────
  // Build a map: member_token → category_label → total_days
  const memberCatMap: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    if (!memberCatMap[row.member_token]) memberCatMap[row.member_token] = {};
    memberCatMap[row.member_token][row.category_label] =
      (memberCatMap[row.member_token][row.category_label] ?? 0) + row.total_days;
  }

  // Only show members who have any data
  const activeMembers = members.filter((m) => memberCatMap[m.token]);
  const memberTotals = activeMembers.map((m) =>
    catLabels.reduce((s, cat) => s + (memberCatMap[m.token]?.[cat] ?? 0), 0)
  );
  const maxMemberTotal = Math.max(...memberTotals, 1);

  function fmt(n: number) {
    return n % 1 === 0 ? String(n) : n.toFixed(1);
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mtip-logo.png" alt="MTIP" className="h-7 w-auto shrink-0" />
            <h1 className="text-sm font-semibold text-gray-900">Trend</h1>
            <span className="text-xs text-gray-400">YTD since implementation</span>
          </div>
          <a
            href="/dashboard"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {grandTotal === 0 && (
          <p className="text-sm text-gray-400 text-center py-16">No check-in data yet.</p>
        )}

        {grandTotal > 0 && (
          <>
            {/* ── Section 1: Totals by stage ── */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Days by stage — total
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                {catLabels.map((label) => {
                  const days = totalByCategory[label] ?? 0;
                  const pct = grandTotal > 0 ? (days / grandTotal) * 100 : 0;
                  const barWidth = maxCatDays > 0 ? (days / maxCatDays) * 100 : 0;
                  return (
                    <div key={label} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="w-32 shrink-0 text-sm text-gray-700">{label}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor(label)}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-sm font-medium text-gray-800 shrink-0">
                        {fmt(days)}d
                      </span>
                      <span className="w-10 text-right text-xs text-gray-400 shrink-0">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 px-5 py-3 bg-gray-50">
                  <span className="w-32 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</span>
                  <div className="flex-1" />
                  <span className="w-16 text-right text-sm font-semibold text-gray-900 shrink-0">{fmt(grandTotal)}d</span>
                  <span className="w-10" />
                </div>
              </div>
            </section>

            {/* ── Section 2: Per-member breakdown ── */}
            {activeMembers.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Days by stage — per person
                </h2>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                          Person
                        </th>
                        {catLabels.map((label) => (
                          <th key={label} className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${barColor(label)}`} />
                            {label}
                          </th>
                        ))}
                        <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeMembers.map((member, i) => {
                        const memberTotal = memberTotals[i];
                        const barWidth = maxMemberTotal > 0 ? (memberTotal / maxMemberTotal) * 100 : 0;
                        return (
                          <tr key={member.token} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">
                              {member.name.split(' ')[0]}
                            </td>
                            {catLabels.map((label) => {
                              const days = memberCatMap[member.token]?.[label] ?? 0;
                              return (
                                <td key={label} className="px-4 py-3 text-right text-gray-700 tabular-nums">
                                  {days > 0 ? fmt(days) : <span className="text-gray-300">—</span>}
                                </td>
                              );
                            })}
                            <td className="px-5 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                                  <div className="h-full bg-gray-400 rounded-full" style={{ width: `${barWidth}%` }} />
                                </div>
                                {fmt(memberTotal)}d
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</td>
                        {catLabels.map((label) => {
                          const days = totalByCategory[label] ?? 0;
                          return (
                            <td key={label} className="px-4 py-3 text-right text-sm font-semibold text-gray-800 tabular-nums">
                              {days > 0 ? fmt(days) : <span className="text-gray-300">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-5 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">
                          {fmt(grandTotal)}d
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
