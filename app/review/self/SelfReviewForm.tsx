'use client';

import { useState } from 'react';
import { SELF_REVIEW_HEADLINE, SELF_GOALS_KEY, RATING_LABELS } from '@/lib/reviewQuestions';
import type { CycleQuestion, CycleGoal } from '@/lib/db';

interface Props {
  cycleId: number;
  token: string;
  cycleName: string;
  assignmentId: number;
  existingResponses: Record<string, string>;
  isEditable: boolean;
  questions: CycleQuestion[];
  goals: CycleGoal[];
}

export default function SelfReviewForm({
  assignmentId,
  cycleName,
  existingResponses,
  isEditable,
  questions,
  goals,
}: Props) {
  // Build initial answers: goal progress/comments + question answers + legacy SELF_GOALS_KEY
  const [answers, setAnswers] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    // Legacy goals key for backwards compat
    init[SELF_GOALS_KEY] = existingResponses[SELF_GOALS_KEY] ?? '';
    // Dynamic goal responses
    for (const goal of goals) {
      const progressKey = `goal_progress_${goal.id}`;
      const commentKey = `goal_comment_${goal.id}`;
      const progressRaw = existingResponses[progressKey];
      init[progressKey] = progressRaw !== undefined ? Number(progressRaw) : '';
      init[commentKey] = existingResponses[commentKey] ?? '';
    }
    // Questions
    for (const q of questions) {
      if (q.question_key === SELF_GOALS_KEY) continue; // handled above
      const raw = existingResponses[q.question_key];
      init[q.question_key] = q.question_type === 'rating' && raw !== undefined ? Number(raw) : (raw ?? '');
    }
    return init;
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      // Save all fields
      const allKeys: string[] = [];
      for (const goal of goals) {
        allKeys.push(`goal_progress_${goal.id}`, `goal_comment_${goal.id}`);
      }
      for (const q of questions) {
        allKeys.push(q.question_key);
      }
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
          <p className="text-sm text-gray-500">Thank you. Your self-review has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  // Filter out the special goals_progress key from the questions list (it's shown via goals section)
  const mainQuestions = questions.filter((q) => q.question_key !== SELF_GOALS_KEY);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
          <h1 className="text-xl font-semibold text-gray-900">Self-Review</h1>
          <p className="text-sm text-gray-500 mt-1">{SELF_REVIEW_HEADLINE}</p>
        </div>

        <div className="space-y-5">
          {/* Dynamic goals section */}
          {goals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-sm font-medium text-gray-700 mb-4">Goals this cycle</p>
              <div className="space-y-5">
                {goals.map((goal) => {
                  const progressKey = `goal_progress_${goal.id}`;
                  const commentKey = `goal_comment_${goal.id}`;
                  return (
                    <div key={goal.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <p className="text-sm text-gray-800 mb-3 font-medium">{goal.body}</p>
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">Progress (1–5)</p>
                        {isEditable ? (
                          <div className="flex gap-3 flex-wrap">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={progressKey}
                                  value={n}
                                  checked={answers[progressKey] === n}
                                  onChange={() => handleRatingChange(progressKey, n)}
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
                            {answers[progressKey]
                              ? RATING_LABELS[answers[progressKey] as number] ?? String(answers[progressKey])
                              : <span className="text-gray-400">No response</span>}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Comment</p>
                        {isEditable ? (
                          <textarea
                            rows={3}
                            className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent placeholder-gray-400"
                            placeholder="Reflect on your progress toward this goal…"
                            value={String(answers[commentKey] ?? '')}
                            onChange={(e) => handleChange(commentKey, e.target.value)}
                            onBlur={() => handleBlur(commentKey)}
                          />
                        ) : (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {answers[commentKey] || <span className="text-gray-400">No response</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fallback: legacy free-text goals if no dynamic goals */}
          {goals.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Goals &amp; progress
              </label>
              {isEditable ? (
                <textarea
                  rows={5}
                  className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent placeholder-gray-400"
                  placeholder="Reflect on your goals and progress over the past year…"
                  value={String(answers[SELF_GOALS_KEY])}
                  onChange={(e) => handleChange(SELF_GOALS_KEY, e.target.value)}
                  onBlur={() => handleBlur(SELF_GOALS_KEY)}
                />
              ) : (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {answers[SELF_GOALS_KEY] || <span className="text-gray-400">No response</span>}
                </div>
              )}
            </div>
          )}

          {/* Dynamic questions */}
          {mainQuestions.map((q) => (
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
            <div className="pt-2 pb-8">
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
