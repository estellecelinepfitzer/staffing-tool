'use client';

import { useState } from 'react';
import { SELF_REVIEW_HEADLINE, RATING_LABELS } from '@/lib/reviewQuestions';
import type { CycleQuestion } from '@/lib/db';

interface MemberGoalExtended {
  id: number;
  body: string;
  description: string;
  progress: number;
  progress_comment: string;
  scale: 'rating_5' | 'percent_100';
}

interface GoalState {
  progress: number;
  comment: string;
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
  managerToken?: string;
  subjectToken?: string;
}

export default function SelfReviewForm({
  cycleId,
  token,
  assignmentId,
  cycleName,
  existingResponses,
  isEditable,
  questions,
  goals,
  managerToken,
  subjectToken,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    for (const q of questions) {
      const raw = existingResponses[q.question_key];
      init[q.question_key] = q.question_type === 'rating' && raw !== undefined ? Number(raw) : (raw ?? '');
      const commentKey = `${q.question_key}_comment`;
      init[commentKey] = existingResponses[commentKey] ?? '';
    }
    return init;
  });

  const [goalStates, setGoalStates] = useState<Record<number, GoalState>>(() =>
    Object.fromEntries(
      goals.map((g) => [g.id, { progress: g.progress ?? 0, comment: g.progress_comment ?? '' }]),
    ),
  );

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
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

  async function saveGoal(goalId: number, state: GoalState) {
    try {
      await fetch(`/api/review/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: state.progress, progress_comment: state.comment }),
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

  async function handleGoalProgressChange(goalId: number, value: number) {
    const next = { ...goalStates[goalId], progress: value };
    setGoalStates((prev) => ({ ...prev, [goalId]: next }));
    await saveGoal(goalId, next);
  }

  function handleGoalCommentChange(goalId: number, value: string) {
    setGoalStates((prev) => ({ ...prev, [goalId]: { ...prev[goalId], comment: value } }));
  }

  async function handleGoalCommentBlur(goalId: number) {
    await saveGoal(goalId, goalStates[goalId]);
  }

  async function handleSaveProgress() {
    setSavingProgress(true);
    try {
      const allKeys = questions.map((q) => q.question_key);
      const commentKeys = questions.filter((q) => q.question_type === 'rating').map((q) => `${q.question_key}_comment`);
      await Promise.all([
        ...allKeys.map((key) => saveField(key, answers[key] ?? '')),
        ...commentKeys.map((key) => saveField(key, answers[key] ?? '')),
        ...goals.map((g) => saveGoal(g.id, goalStates[g.id])),
      ]);
      window.location.href = `/my-reviews?token=${token}`;
    } catch {
      // silent failure
    } finally {
      setSavingProgress(false);
    }
  }

  async function handleSubmit() {
    const missingItems: string[] = [];

    // All questions are required
    for (const q of questions) {
      if (answers[q.question_key] === '' || answers[q.question_key] === undefined || answers[q.question_key] === 0) {
        missingItems.push(q.question_text);
      }
      if (q.question_type === 'rating') {
        const commentKey = `${q.question_key}_comment`;
        if (!String(answers[commentKey] ?? '').trim()) {
          missingItems.push(`${q.question_text} — comment`);
        }
      }
    }

    // All goals require progress (rating_5) and a comment
    for (const goal of goals) {
      const state = goalStates[goal.id];
      if (goal.scale === 'rating_5' && (!state.progress || state.progress === 0)) {
        missingItems.push(`"${goal.body}" — progress rating`);
      }
      if (!state.comment?.trim()) {
        missingItems.push(`"${goal.body}" — comment`);
      }
    }

    if (missingItems.length > 0) {
      setValidationError(missingItems.join('||'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    try {
      const allKeys = questions.map((q) => q.question_key);
      const commentKeys = questions.filter((q) => q.question_type === 'rating').map((q) => `${q.question_key}_comment`);
      await Promise.all([
        ...allKeys.map((key) => saveField(key, answers[key] ?? '')),
        ...commentKeys.map((key) => saveField(key, answers[key] ?? '')),
        ...goals.map((g) => saveGoal(g.id, goalStates[g.id])),
      ]);
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

  const pdfHref = managerToken && subjectToken
    ? `/review/manager/print?cycle=${cycleId}&token=${managerToken}&subject=${subjectToken}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
            <h1 className="text-xl font-semibold text-gray-900">Self-Review</h1>
            <p className="text-sm text-gray-500 mt-1">{SELF_REVIEW_HEADLINE}</p>
          </div>
          {pdfHref && (
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Download PDF
            </a>
          )}
        </div>

        <div className="space-y-5">

          {/* ── Goals — first section ── */}
          {goals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-sm font-medium text-gray-700 mb-4">Goals</p>
              <div className="space-y-6">
                {goals.map((goal) => {
                  const state = goalStates[goal.id] ?? { progress: 0, comment: '' };
                  return (
                    <div key={goal.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-gray-800 mb-0.5">{goal.body}</p>
                      {goal.description && (
                        <p className="text-xs text-gray-500 mb-3">{goal.description}</p>
                      )}

                      {/* Progress input */}
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">Progress</p>
                        {goal.scale === 'percent_100' ? (
                          isEditable ? (
                            <div className="flex items-center gap-3">
                              <input
                                type="range" min={0} max={100} step={5}
                                value={state.progress}
                                onChange={(e) => handleGoalProgressChange(goal.id, Number(e.target.value))}
                                className="flex-1 accent-[#0080C8]"
                              />
                              <span className="text-xs text-gray-600 w-10 text-right">{Math.round(state.progress)}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 max-w-[120px] bg-gray-100 rounded-full h-1.5">
                                <div className="bg-brand-teal h-1.5 rounded-full" style={{ width: `${state.progress}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{Math.round(state.progress)}%</span>
                            </div>
                          )
                        ) : isEditable ? (
                          <div>
                            <div className="flex gap-5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio" name={`goal_${goal.id}`} value={n}
                                    checked={state.progress === n}
                                    onChange={() => handleGoalProgressChange(goal.id, n)}
                                    className="w-4 h-4 accent-[#0080C8]"
                                  />
                                  <span className="text-xs text-gray-400">{n}</span>
                                </label>
                              ))}
                            </div>
                            {state.progress > 0 && (
                              <p className="text-xs text-gray-500 mt-1.5">{RATING_LABELS[state.progress]}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-700">
                            {state.progress > 0 ? RATING_LABELS[state.progress] : <span className="text-gray-400">—</span>}
                          </span>
                        )}
                      </div>

                      {/* Comment */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Comment</p>
                        {isEditable ? (
                          <textarea
                            rows={2}
                            className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent placeholder-gray-400"
                            placeholder="Describe your progress on this goal…"
                            value={state.comment}
                            onChange={(e) => handleGoalCommentChange(goal.id, e.target.value)}
                            onBlur={() => handleGoalCommentBlur(goal.id)}
                          />
                        ) : (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {state.comment || <span className="text-gray-400">No comment</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Review questions ── */}
          {questions.map((q) => (
            <div key={q.question_key} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {q.question_text}
              </label>
              {q.question_type === 'rating' ? (
                isEditable ? (
                  <div>
                    <div className="flex gap-5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name={q.question_key}
                            value={n}
                            checked={answers[q.question_key] === n}
                            onChange={() => handleRatingChange(q.question_key, n)}
                            className="w-4 h-4 accent-[#0080C8]"
                          />
                          <span className="text-xs text-gray-500">{n}</span>
                        </label>
                      ))}
                    </div>
                    {answers[q.question_key] !== '' && answers[q.question_key] !== undefined && (
                      <p className="text-xs text-gray-500 mt-1.5">{RATING_LABELS[answers[q.question_key] as number]}</p>
                    )}
                    <textarea
                      rows={2}
                      className="mt-3 block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent placeholder-gray-400"
                      placeholder="Add a comment…"
                      value={String(answers[`${q.question_key}_comment`] ?? '')}
                      onChange={(e) => handleChange(`${q.question_key}_comment`, e.target.value)}
                      onBlur={() => handleBlur(`${q.question_key}_comment`)}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-sm text-gray-700">
                      {answers[q.question_key]
                        ? RATING_LABELS[answers[q.question_key] as number] ?? String(answers[q.question_key])
                        : <span className="text-gray-400">No response</span>}
                    </div>
                    {answers[`${q.question_key}_comment`] && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{answers[`${q.question_key}_comment`]}</p>
                    )}
                  </div>
                )
              ) : isEditable ? (
                <textarea
                  rows={4}
                  className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent placeholder-gray-400"
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
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-700 mb-1">Please complete all fields before submitting:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {validationError.split('||').map((item, i) => (
                      <li key={i} className="text-sm text-red-600">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || savingProgress}
                className="w-full bg-brand-blue text-white rounded-xl py-3 text-sm font-medium hover:bg-[#006BB0] active:bg-[#005A96] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit self-review'}
              </button>
              <button
                onClick={handleSaveProgress}
                disabled={submitting || savingProgress}
                className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {savingProgress ? 'Saving…' : 'Save progress & return to profile'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
