'use client';

import { useState } from 'react';
import type { TeamMember } from '@/config/team';

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExistingCheckin {
  mood: number;
  capacity: number;
  sourcing: string;
  converting: string;
  execution: string;
  portfolio_exits: string;
  portfolio_other: string;
}

interface Props {
  member: TeamMember;
  existing: ExistingCheckin | null;
  isoWeek: number;
  isoYear: number;
  today: string;
  weekLabel: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckinForm({ member, existing, isoWeek, isoYear, today, weekLabel }: Props) {
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
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setDealField(key: DealKey, value: string) {
    setDealFields((prev) => ({ ...prev, [key]: value }));
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
          mood,
          capacity,
          ...dealFields,
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

          {/* Deal stages */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 pt-4 pb-2 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-700">Deal Pipeline</h2>
              <p className="text-xs text-gray-400 mt-0.5">All fields optional</p>
            </div>
            <div className="divide-y divide-gray-100">
              {DEAL_FIELDS.map(({ key, label, sub }) => (
                <div key={key} className="px-5 py-4">
                  <label className="block text-sm text-gray-700 mb-1.5">
                    <span className="font-medium">{label}</span>
                    <span className="text-gray-400"> — {sub}</span>
                  </label>
                  <textarea
                    value={dealFields[key]}
                    onChange={(e) => setDealField(key, e.target.value)}
                    rows={3}
                    placeholder="—"
                    className="block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent focus:bg-white resize-y transition-colors"
                  />
                </div>
              ))}
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
