'use client';

import { useState } from 'react';
interface TeamMember { name: string; token: string; }
interface Category { id: number; label: string; sort_order: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayOptions(max: number): number[] {
  const opts: number[] = [];
  for (let v = 0; v <= max; v += 0.5) opts.push(v);
  return opts;
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryResponse { category_id: number; category_label?: string; days: number; notes: string; }

interface ExistingCheckin {
  mood: number;
  capacity: number;
  working_days: number;
  category_responses?: CategoryResponse[];
  // legacy flat fields (backward compat)
  sourcing?: string; sourcing_days?: number;
  converting?: string; converting_days?: number;
  execution?: string; execution_days?: number;
  portfolio_exits?: string; portfolio_exits_days?: number;
  portfolio_other?: string; portfolio_other_days?: number;
}

interface MemberGoal { id: number; body: string; }

interface Props {
  member: TeamMember;
  existing: ExistingCheckin | null;
  isoWeek: number;
  isoYear: number;
  today: string;
  weekLabel: string;
  token: string;
  goals?: MemberGoal[];
  categories: Category[];
  weekLocked?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckinForm({ member, existing, isoWeek, isoYear, today, weekLabel, token, goals, categories, weekLocked }: Props) {
  const isUpdate = !!existing;

  const initCategoryData = (): Record<number, { notes: string; days: number }> => {
    const init: Record<number, { notes: string; days: number }> = {};
    for (const cat of categories) {
      init[cat.id] = { notes: '', days: 0 };
    }
    if (existing?.category_responses) {
      for (const cr of existing.category_responses) {
        if (init[cr.category_id] !== undefined) {
          init[cr.category_id] = { notes: cr.notes, days: cr.days };
        }
      }
    }
    return init;
  };

  const [date, setDate] = useState(today);
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [capacity, setCapacity] = useState<number | null>(existing?.capacity ?? null);
  const [categoryData, setCategoryData] = useState<Record<number, { notes: string; days: number }>>(initCategoryData);
  const [workingDays, setWorkingDays] = useState<number>(existing?.working_days ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});

  function setCatNotes(id: number, notes: string) {
    setCategoryData((prev) => ({ ...prev, [id]: { ...prev[id], notes } }));
  }
  function setCatDays(id: number, days: number) {
    setCategoryData((prev) => ({ ...prev, [id]: { ...prev[id], days } }));
  }

  function handleWorkingDaysChange(days: number) {
    setWorkingDays(days);
    setCategoryData((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        const numId = Number(id);
        if (next[numId].days > days) next[numId] = { ...next[numId], days };
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!mood) { setError('Please select how you are feeling today.'); return; }
    if (!capacity) { setError('Please select your capacity this week.'); return; }

    if (!isUpdate) {
      const errors: Record<number, string> = {};
      for (const cat of categories) {
        const data = categoryData[cat.id];
        if ((data?.days ?? 0) > 0 && !data?.notes.trim()) {
          errors[cat.id] = 'Required — please add at least a brief note.';
        }
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError('Please fill in all deal pipeline notes before submitting.');
        return;
      }
    }
    setFieldErrors({});

    setSubmitting(true);
    setError(null);

    try {
      const categoryResponses = categories.map((cat) => ({
        category_id: cat.id,
        days: workingDays === 0 ? 0 : (categoryData[cat.id]?.days ?? 0),
        notes: categoryData[cat.id]?.notes ?? '',
      }));

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: member.token,
          week: isoWeek,
          year: isoYear,
          mood,
          capacity,
          working_days: workingDays,
          category_responses: categoryResponses,
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

  // ── Locked week screen ──────────────────────────────────────────────────────

  if (weekLocked) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-xl mx-auto px-4 py-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mtip-logo.png" alt="MTIP" className="h-8 w-auto mb-8" />
          <div className="mb-8">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{weekLabel}</p>
            <h1 className="text-2xl font-semibold text-gray-900 leading-tight">{member.name}</h1>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
            <p className="font-medium mb-1">This week is closed.</p>
            <p>Submissions can only be edited during the active week.</p>
          </div>
          {existing && (
            <div className="mt-6 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Mood</p>
                <p className="text-sm text-gray-700">{existing.mood} — {MOOD_OPTIONS.find(o => o.value === existing.mood)?.label}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Capacity</p>
                <p className="text-sm text-gray-700">{existing.capacity} — {CAPACITY_OPTIONS.find(o => o.value === existing.capacity)?.label}</p>
              </div>
              {existing.category_responses && existing.category_responses.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 pt-4 pb-2 border-b border-gray-100">
                    <h2 className="text-sm font-medium text-gray-700">Deal Pipeline</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {existing.category_responses.map((cr) => {
                      const cat = categories.find(c => c.id === cr.category_id);
                      return (
                        <div key={cr.category_id} className="px-5 py-3">
                          <p className="text-sm font-medium text-gray-700">{cr.category_label || cat?.label}</p>
                          {cr.days > 0 && <p className="text-xs text-gray-500 mt-0.5">{cr.days}d / {existing.working_days}d</p>}
                          {cr.notes && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{cr.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="mt-6">
            <a href={`/my-reviews?token=${token}`} className="inline-block rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              ← Back to my profile
            </a>
          </div>
        </div>
      </div>
    );
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
          <p className="text-sm text-gray-500 mb-1">Thanks, {member.name.split(' ')[0]}.</p>
          <p className="text-sm text-gray-400 mb-6">{weekLabel}</p>
          <a href={`/my-reviews?token=${token}`} className="inline-block rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            ← Back to my profile
          </a>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  const totalAllocated = Object.values(categoryData).reduce((a, b) => a + b.days, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-10 pb-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mtip-logo.png" alt="MTIP" className="h-8 w-auto mb-8" />

        {/* Goals section */}
        {goals && goals.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-6">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Your goals this cycle</h2>
            <ul className="space-y-2">
              {goals.map((goal, i) => (
                <li key={goal.id} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-gray-400 shrink-0">{i + 1}.</span>
                  <span>{goal.body}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
              className="block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
            />
          </Section>

          {/* Mood */}
          <Section title="How are you feeling today?">
            <RadioGroup name="mood" options={MOOD_OPTIONS} value={mood} onChange={setMood} />
          </Section>

          {/* Working days */}
          <Section title="Working days this week">
            <div className="flex items-center gap-3">
              <select
                value={workingDays}
                onChange={(e) => handleWorkingDaysChange(Number(e.target.value))}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
              >
                {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((d) => (
                  <option key={d} value={d}>{d === 0.5 ? '½ day' : d === 1 ? '1 day' : d % 1 === 0.5 ? `${Math.floor(d)}½ days` : `${d} days`}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400">0 = holiday / fully out</span>
            </div>
          </Section>

          {/* Deal stages */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 pt-4 pb-2 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-700">Deal Pipeline</h2>
                {workingDays > 0 && (() => {
                  const remaining = workingDays - totalAllocated;
                  return (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      remaining === 0 ? 'text-red-700 bg-red-50 border border-red-200'
                      : remaining <= 0.5 ? 'text-amber-700 bg-amber-50 border border-amber-200'
                      : 'text-gray-500'
                    }`}>
                      {remaining}d remaining
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Notes required · days default to 0</p>
            </div>
            <div className="divide-y divide-gray-100">
              {categories.map((cat) => {
                const data = categoryData[cat.id] ?? { notes: '', days: 0 };
                const remaining = workingDays - totalAllocated;
                const maxForBucket = Math.min(data.days + remaining, workingDays);
                const opts = dayOptions(maxForBucket);
                const hasError = !!fieldErrors[cat.id];
                return (
                  <div key={cat.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-1.5">
                      <label className="text-sm font-medium text-gray-700">{cat.label}</label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={data.days}
                          onChange={(e) => setCatDays(cat.id, Number(e.target.value))}
                          disabled={workingDays === 0}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {opts.map((v) => <option key={v} value={v}>{v}d</option>)}
                        </select>
                        {workingDays > 0 && (
                          <span className="text-xs text-gray-400 w-12 text-right">/ {workingDays}d</span>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={data.notes}
                      onChange={(e) => {
                        setCatNotes(cat.id, e.target.value);
                        if (fieldErrors[cat.id] && e.target.value.trim()) {
                          setFieldErrors((prev) => { const next = { ...prev }; delete next[cat.id]; return next; });
                        }
                      }}
                      rows={3}
                      placeholder="—"
                      className={`block w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent resize-y transition-colors ${hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
                    />
                    {hasError && <p className="text-xs text-red-600 mt-1">{fieldErrors[cat.id]}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capacity */}
          <Section title="Capacity this week">
            <RadioGroup name="capacity" options={CAPACITY_OPTIONS} value={capacity} onChange={setCapacity} />
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
            className="w-full bg-brand-blue text-white rounded-xl py-3.5 text-sm font-medium hover:bg-[#006BB0] active:bg-[#005A96] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

function RadioGroup({ name, options, value, onChange }: {
  name: string;
  options: { value: number; label: string }[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
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
