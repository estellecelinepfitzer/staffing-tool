'use client';

import { useState } from 'react';
interface TeamMember { name: string; token: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate [0, 0.5, 1, …, max] options */
function dayOptions(max: number): number[] {
  const opts: number[] = [];
  for (let v = 0; v <= max; v += 0.5) opts.push(v);
  return opts;
}

function formatDays(v: number): string {
  return v === 0 ? '0' : v % 1 === 0 ? String(v) : String(v);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOOD_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Not able to work' },
  { value: 2, label: 'Not good' },
  { value: 3, label: 'Fine' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];

const CAPACITY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Vacation' },
  { value: 2, label: 'Has significant capacity' },
  { value: 3, label: 'Has some capacity' },
  { value: 4, label: 'Fully staffed with a live deal' },
  { value: 5, label: 'Crunch period: execution phase' },
];

const DEAL_FIELDS = [
  { key: 'sourcing',        label: 'Sourcing',         sub: 'IC0 "one-pager"' },
  { key: 'converting',      label: 'Converting',       sub: 'IC1 "BC"'        },
  { key: 'execution',       label: 'Execution',        sub: 'IC2-3 "EP/IM"'   },
  { key: 'portfolio_exits', label: 'Portfolio',        sub: 'Exits'           },
  { key: 'portfolio_other', label: 'Portfolio',        sub: 'Other'           },
] as const;

type DealKey = (typeof DEAL_FIELDS)[number]['key'];
type DayKey = `${DealKey}_days`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExistingCheckin {
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
}

interface Props {
  member: TeamMember;
  existing: ExistingCheckin | null;
  isoWeek: number;
  isoYear: number;
  today: string;
  weekLabel: string;
  token: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckinForm({ member, existing, isoWeek, isoYear, today, weekLabel, token }: Props) {
  const isUpdate = !!existing;

  const [date, setDate] = useState(today);
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [capacity, setCapacity] = useState<number | null>(existing?.capacity ?? null);
  const [dealFields, setDealFields] = useState<Record<DealKey, string>>({
    sourcing:        existing?.sourcing        ?? '',
    converting:      existing?.converting      ?? '',
    execution:       existing?.execution       ?? '',
    portfolio_exits: existing?.portfolio_exits ?? '',
    portfolio_other: existing?.portfolio_other ?? '',
  });
  const [workingDays, setWorkingDays] = useState<number>(existing?.working_days ?? 0);
  const [dayFields, setDayFields] = useState<Record<DayKey, number>>({
    sourcing_days:        existing?.sourcing_days        ?? 0,
    converting_days:      existing?.converting_days      ?? 0,
    execution_days:       existing?.execution_days       ?? 0,
    portfolio_exits_days: existing?.portfolio_exits_days ?? 0,
    portfolio_other_days: existing?.portfolio_other_days ?? 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setDealField(key: DealKey, value: string) {
    setDealFields((prev) => ({ ...prev, [key]: value }));
  }

  function setDayField(key: DayKey, value: number) {
    setDayFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleWorkingDaysChange(days: number) {
    setWorkingDays(days);
    // Clamp any bucket allocations that now exceed the new working days
    setDayFields((prev) => {
      const next = { ...prev };
      (Object.keys(next) as DayKey[]).forEach((k) => {
        if (next[k] > days) next[k] = days;
      });
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!mood) { setError('Please select how you are feeling today.'); return; }
    if (!capacity) { setError('Please select your capacity this week.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: member.token,
          week: isoWeek,
          year: isoYear,
          mood,
          capacity,
          ...dealFields,
          working_days: workingDays,
          ...dayFields,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Something went wrong');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            {isUpdate ? 'Response updated' : 'Check-in submitted'}
          </h1>
          <p className="text-sm text-gray-500 mb-1">
            Thanks, {member.name.split(' ')[0]}.
          </p>
          <p className="text-sm text-gray-400">{weekLabel}</p>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-10 pb-16">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{weekLabel}</p>
          <h1 className="text-2xl font-semibold text-gray-900 leading-tight">{member.name}</h1>
          {isUpdate && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Updating your existing response
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Date */}
          <Section title="Today's Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            />
          </Section>

          {/* Mood */}
          <Section title="How are you feeling today?">
            <RadioGroup
              name="mood"
              options={MOOD_OPTIONS}
              value={mood}
              onChange={setMood}
            />
          </Section>

          {/* Working days */}
          <Section title="Working days this week">
            <div className="flex items-center gap-3">
              <select
                value={workingDays}
                onChange={(e) => handleWorkingDaysChange(Number(e.target.value))}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              >
                {[0, 1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400">0 = holiday / fully out</span>
            </div>
          </Section>

          {/* Deal stages */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 pt-4 pb-2 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-700">Deal Pipeline</h2>
              <p className="text-xs text-gray-400 mt-0.5">Notes optional — days default to 0</p>
            </div>
            <div className="divide-y divide-gray-100">
              {DEAL_FIELDS.map(({ key, label, sub }) => {
                const dayKey: DayKey = `${key}_days`;
                const opts = dayOptions(workingDays);
                return (
                  <div key={key} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-1.5">
                      <label className="text-sm text-gray-700">
                        <span className="font-medium">{label}</span>
                        <span className="text-gray-400"> — {sub}</span>
                      </label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={dayFields[dayKey]}
                          onChange={(e) => setDayField(dayKey, Number(e.target.value))}
                          disabled={workingDays === 0}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {opts.map((v) => (
                            <option key={v} value={v}>{formatDays(v)}d</option>
                          ))}
                        </select>
                        {workingDays > 0 && (
                          <span className="text-xs text-gray-400 w-12 text-right">
                            / {workingDays}d
                          </span>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={dealFields[key]}
                      onChange={(e) => setDealField(key, e.target.value)}
                      rows={3}
                      placeholder="—"
                      className="block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent focus:bg-white resize-y transition-colors"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capacity */}
          <Section title="Capacity this week">
            <RadioGroup
              name="capacity"
              options={CAPACITY_OPTIONS}
              value={capacity}
              onChange={setCapacity}
            />
          </Section>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gray-900 text-white rounded-xl py-3.5 text-sm font-medium hover:bg-gray-700 active:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Saving…' : isUpdate ? 'Update response' : 'Submit check-in'}
          </button>

          {/* Change password link */}
          <p className="text-center text-xs text-gray-400">
            <a href={`/change-password?token=${token}`} className="underline hover:text-gray-600">
              Change password
            </a>
          </p>

        </form>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: number; label: string }[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="h-4 w-4 shrink-0 border-gray-300 cursor-pointer"
          />
          <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors leading-tight">
            <span className="font-medium text-gray-900">{opt.value}</span>
            {' — '}
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  );
}
