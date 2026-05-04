'use client';

import { useState } from 'react';
import { SELF_REVIEW_HEADLINE, RATING_LABELS } from '@/lib/reviewQuestions';
import type { CycleQuestion } from '@/lib/db';

interface MemberGoalExtended {
  id: number;
  body: string;
  description: string;
  progress: number;
  company_goal_id: number | null;
}

interface Props {
  cycleId: number;
  token: string;
  cycleName: string;
  assignmentId: number;
  existingResponses: Record<string, string>;
  isEditable: boolean;
  questions: CycleQuestion[];
  goals: MemberGoalExtended[];
  goalScale: 'rating_5' | 'percent_100';
}

export default function SelfReviewForm({
  token,
  assignmentId,
  cycleName,
  existingResponses,
  isEditable,
  questions,
  goals,
  goalScale,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    for (const q of questions) {
      const raw = existingResponses[q.question_key];
      init[q.question_key] = q.question_type === 'rating' && raw !== undefined ? Number(raw) : (raw ?? '');
    }
    return init;
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  async function saveField(key: string, value: string | number) {
    try {
      const body: Record<string, unknown> = { assignment_id: assignmentId, question_key: key };
      if (typeof value === 'number') {
        body.answer_number = value;
      } else {
        body.answer_text = value;
      }
      await fetch('/api/review/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // silent failure
    }
  }

  function handleChange(key: string, value: string | number) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleBlur(key: string) {
    await saveField(key, answers[key] ?? '');
  }

  async function handleRatingChange(key: string, value: number) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    await saveField(key, value);
  }

  async function handleSubmit() {
    const missing = questions.filter(
      (q) => q.required === 1 && (answers[q.question_key] === '' || answers[q.question_key] === undefined),
    );
    if (missing.length > 0) {
      setValidationError(`Please fill in all required fields (*): ${missing.map((q) => q.question_text).join(', ')}`);
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    try {
      const allKeys = questions.map((q) => q.question_key);
      await Promise.all(allKeys.map((key) => saveField(key, answers[key] ?? '')));
      const res = await fetch('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // silent failure
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Self-review submitted</h1>
          <p className="text-sm text-gray-500 mb-6">Thank you. Your self-review has been submitted successfully.</p>
          <a
            href={`/my-reviews?token=${token}`}
            className="inline-block rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← Back to my profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
          <h1 className="text-xl font-semibold text-gray-900">Self-Review</h1>
          <p className="text-sm text-gray-500 mt-1">{SELF_REVIEW_HEADLINE}</p>
        </div>

        <div className="space-y-5">
          {/* Goals reference (read-only) */}
          {goals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-sm font-medium text-gray-700 mb-4">Your goals</p>
              <div className="space-y-4">
                {goals.map((goal) => (
                  <div key={goal.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-gray-800 mb-1">{goal.body}</p>
                    {goal.description && (
                      <p className="text-xs text-gray-500 mb-2">{goal.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-400">Progress:</span>
                      {goalScale === 'percent_100' ? (
                        <>
                          <div className="flex-1 max-w-[120px] bg-gray-100 rounded-full h-1.5">
                            <div className="bg-gray-700 h-1.5 rounded-full" style={{ width: `${goal.progress}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{Math.round(goal.progress)}%</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-700">
                          {goal.progress > 0 ? `${goal.progress} / 5` : <span className="text-gray-400">—</span>}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions */}
          {questions.map((q) => (
            <div key={q.question_key} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {q.question_text}
                {q.required === 1 && <span className="text-gray-400 ml-1">*</span>}
              </label>
              {q.question_type === 'rating' ? (
                isEditable ? (
                  <div className="flex gap-3 flex-wrap">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={q.question_key}
                          value={n}
                          checked={answers[q.question_key] === n}
                          onChange={() => handleRatingChange(q.question_key, n)}
                          className="w-4 h-4 accent-gray-800"
                        />
                        <span className="text-xs text-gray-500 text-center max-w-[80px]">
                          {RATING_LABELS[n]}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-700">
                    {answers[q.question_key]
                      ? RATING_LABELS[answers[q.question_key] as number] ?? String(answers[q.question_key])
                      : <span className="text-gray-400">No response</span>}
                  </div>
                )
              ) : isEditable ? (
                <textarea
                  rows={4}
                  className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent placeholder-gray-400"
                  placeholder={q.placeholder ?? ''}
                  value={String(answers[q.question_key] ?? '')}
                  onChange={(e) => handleChange(q.question_key, e.target.value)}
                  onBlur={() => handleBlur(q.question_key)}
                />
              ) : (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {answers[q.question_key] || <span className="text-gray-400">No response</span>}
                </div>
              )}
            </div>
          ))}

          {isEditable && (
            <div className="pt-2 pb-8 space-y-3">
              {validationError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{validationError}</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 active:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit self-review'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
