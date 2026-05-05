'use client';

import { useState } from 'react';
import { RATING_LABELS } from '@/lib/reviewQuestions';
import type { CycleQuestion } from '@/lib/db';

interface MemberGoalExtended {
  id: number;
  body: string;
  description: string;
  progress: number;
  progress_comment: string;
  manager_progress: number | null;
  manager_comment: string;
  company_goal_id: number | null;
  scale: 'rating_5' | 'percent_100';
}

interface PeerReview {
  responses: Record<string, string | number>;
}

interface Props {
  cycleId: number;
  managerToken: string;
  subjectToken: string;
  subjectName: string;
  cycleName: string;
  assignmentId: number;
  existingResponses: Record<string, string | number>;
  selfReviewResponses: Record<string, string>;
  peerReviews: PeerReview[];
  selfGoals: string;
  isEditable: boolean;
  isSignedOff: boolean;
  isReleased: boolean;
  questions: CycleQuestion[];
  selfQuestions: CycleQuestion[];
  goals: MemberGoalExtended[];
}

interface ManagerGoalState {
  managerProgress: number | null;
  managerComment: string;
}

function BackToProfile({ token }: { token: string }) {
  return (
    <div className="pt-2 pb-4">
      <a
        href={`/my-reviews?token=${token}`}
        className="block w-full text-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        ← Back to my profile
      </a>
    </div>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  );
}

function RatingDisplay({ value }: { value: string | number }) {
  if (value === '' || value === undefined) return <span className="text-gray-400 text-sm">No response</span>;
  const n = Number(value);
  return <span className="text-sm text-gray-800">{RATING_LABELS[n] ?? String(value)}</span>;
}

export default function ManagerReviewForm({
  cycleId,
  managerToken,
  subjectToken,
  subjectName,
  cycleName,
  assignmentId,
  existingResponses,
  selfReviewResponses,
  peerReviews,
  isEditable,
  isSignedOff,
  isReleased: isReleasedProp,
  questions,
  selfQuestions,
  goals,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    for (const q of questions) {
      const raw = existingResponses[q.question_key];
      init[q.question_key] = q.question_type === 'rating' && raw !== undefined ? Number(raw) : (raw ?? '');
    }
    return init;
  });

  const [managerGoalStates, setManagerGoalStates] = useState<Record<number, ManagerGoalState>>(() =>
    Object.fromEntries(
      goals.map((g) => [g.id, { managerProgress: g.manager_progress ?? null, managerComment: g.manager_comment ?? '' }]),
    ),
  );

  const [submitting, setSubmitting] = useState(false);
  const [signedOff, setSignedOff] = useState(isSignedOff);
  const [released, setReleased] = useState(isReleasedProp);
  const [releasing, setReleasing] = useState(false);

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

  async function saveManagerGoal(goalId: number, state: ManagerGoalState) {
    try {
      await fetch(`/api/review/manager-goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_progress: state.managerProgress, manager_comment: state.managerComment }),
      });
    } catch {
      // silent failure
    }
  }

  function updateManagerGoal(goalId: number, patch: Partial<ManagerGoalState>) {
    setManagerGoalStates((prev) => ({ ...prev, [goalId]: { ...prev[goalId], ...patch } }));
  }

  async function handleManagerProgressChange(goalId: number, value: number) {
    const next = { ...managerGoalStates[goalId], managerProgress: value };
    setManagerGoalStates((prev) => ({ ...prev, [goalId]: next }));
    await saveManagerGoal(goalId, next);
  }

  async function handleManagerCommentBlur(goalId: number) {
    await saveManagerGoal(goalId, managerGoalStates[goalId]);
  }

  function handleTextChange(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleTextBlur(key: string) {
    await saveField(key, answers[key] ?? '');
  }

  async function handleRatingChange(key: string, value: number) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    await saveField(key, value);
  }

  async function handleSignOff() {
    setSubmitting(true);
    try {
      const allKeys = questions.map((q) => q.question_key);
      await Promise.all(allKeys.map((key) => saveField(key, answers[key] ?? '')));
      const res = await fetch('/api/review/signoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId, subject_token: subjectToken, assignment_id: assignmentId }),
      });
      if (res.ok) setSignedOff(true);
    } catch {
      // silent failure
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRelease() {
    setReleasing(true);
    try {
      const res = await fetch('/api/review/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId, subject_token: subjectToken }),
      });
      if (res.ok) setReleased(true);
    } catch {
      // silent failure
    } finally {
      setReleasing(false);
    }
  }

  const pdfHref = `/review/manager/print?cycle=${cycleId}&token=${managerToken}&subject=${subjectToken}`;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
          <h1 className="text-xl font-semibold text-gray-900">Manager review — {subjectName}</h1>
        </div>

        <div className="space-y-4">

          {/* ── Goals — top ── */}
          {goals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-sm font-medium text-gray-700 mb-4">Goals — {subjectName}</p>
              <div className="space-y-6">
                {goals.map((goal) => {
                  const state = managerGoalStates[goal.id] ?? { managerProgress: null, managerComment: '' };
                  const displayProgress = (state.managerProgress !== null && state.managerProgress !== undefined)
                    ? state.managerProgress
                    : goal.progress;

                  return (
                    <div key={goal.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-gray-800 mb-0.5">{goal.body}</p>
                      {goal.description && (
                        <p className="text-xs text-gray-500 mb-3">{goal.description}</p>
                      )}

                      {/* Manager scale input */}
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Progress
                          {state.managerProgress !== null && state.managerProgress !== undefined && (
                            <span className="ml-1.5 text-gray-400 font-normal">(manager override)</span>
                          )}
                        </p>
                        {goal.scale === 'percent_100' ? (
                          isEditable ? (
                            <div className="flex items-center gap-3">
                              <input
                                type="range" min={0} max={100} step={5}
                                value={displayProgress}
                                onChange={(e) => handleManagerProgressChange(goal.id, Number(e.target.value))}
                                className="flex-1 accent-[#0080C8]"
                              />
                              <span className="text-xs text-gray-600 w-10 text-right">{Math.round(displayProgress)}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 max-w-[120px] bg-gray-100 rounded-full h-1.5">
                                <div className="bg-brand-teal h-1.5 rounded-full" style={{ width: `${displayProgress}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{Math.round(displayProgress)}%</span>
                            </div>
                          )
                        ) : isEditable ? (
                          <div>
                            <div className="flex gap-5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio" name={`mgr_goal_${goal.id}`} value={n}
                                    checked={displayProgress === n}
                                    onChange={() => handleManagerProgressChange(goal.id, n)}
                                    className="w-4 h-4 accent-[#0080C8]"
                                  />
                                  <span className="text-xs text-gray-400">{n}</span>
                                </label>
                              ))}
                            </div>
                            {displayProgress > 0 && (
                              <p className="text-xs text-gray-500 mt-1.5">{RATING_LABELS[displayProgress]}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-700">
                            {displayProgress > 0 ? `${displayProgress} / 5` : <span className="text-gray-400">—</span>}
                          </span>
                        )}
                      </div>

                      {/* Employee self-reported comment */}
                      {goal.progress_comment ? (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-400 mb-1">Employee comment</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{goal.progress_comment}</p>
                        </div>
                      ) : null}

                      {/* Manager comment */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Manager comment</p>
                        {isEditable ? (
                          <textarea
                            rows={2}
                            className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent placeholder-gray-400"
                            placeholder="Your assessment of this goal…"
                            value={state.managerComment}
                            onChange={(e) => updateManagerGoal(goal.id, { managerComment: e.target.value })}
                            onBlur={() => handleManagerCommentBlur(goal.id)}
                          />
                        ) : (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {state.managerComment || <span className="text-gray-400">No comment</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Self-review collapsible ── */}
          <Collapsible title="Self-review">
            <div className="space-y-4">
              {selfQuestions.length > 0
                ? selfQuestions.map((q) => {
                    const val = selfReviewResponses[q.question_key];
                    return (
                      <div key={q.question_key} className="mb-4 last:mb-0">
                        <p className="text-xs font-medium text-gray-500 mb-1">{q.question_text}</p>
                        {q.question_type === 'rating' ? (
                          val !== undefined && val !== ''
                            ? <span className="text-sm text-gray-800">{RATING_LABELS[Number(val)] ?? val}</span>
                            : <span className="text-sm text-gray-400">No response</span>
                        ) : (
                          <div className="text-sm text-gray-800 whitespace-pre-wrap">
                            {val !== undefined && val !== ''
                              ? val
                              : <span className="text-gray-400">No response</span>}
                          </div>
                        )}
                      </div>
                    );
                  })
                : Object.entries(selfReviewResponses).map(([key, val]) => (
                    <div key={key} className="mb-4 last:mb-0">
                      <p className="text-xs font-medium text-gray-500 mb-1">{key}</p>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">
                        {val !== '' && val !== undefined ? val : <span className="text-gray-400">No response</span>}
                      </div>
                    </div>
                  ))
              }
            </div>
          </Collapsible>

          {/* ── Peer feedback — per-question, anonymous ── */}
          {peerReviews.length > 0 && (
            <Collapsible title={`Peer feedback (${peerReviews.length} reviewer${peerReviews.length !== 1 ? 's' : ''})`}>
              <div className="space-y-5">
                {questions.map((q) => {
                  const peerAnswers = peerReviews
                    .map((peer) => peer.responses[q.question_key])
                    .filter((v) => v !== '' && v !== undefined && v !== null);
                  if (peerAnswers.length === 0) return null;
                  return (
                    <div key={q.question_key}>
                      <p className="text-xs font-semibold text-gray-600 mb-2">{q.question_text}</p>
                      <ul className="space-y-1.5">
                        {peerAnswers.map((answer, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-gray-300 mt-0.5 shrink-0">–</span>
                            {q.question_type === 'rating' ? (
                              <span className="text-sm text-gray-700">{RATING_LABELS[Number(answer)] ?? String(answer)}</span>
                            ) : (
                              <span className="text-sm text-gray-700 whitespace-pre-wrap">{String(answer)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Collapsible>
          )}

          {/* ── Manager review questions ── */}
          {questions.map((q) => (
            <div key={q.question_key} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
                          className="w-4 h-4 accent-[#0080C8]"
                        />
                        <span className="text-xs text-gray-500 text-center max-w-[80px]">
                          {RATING_LABELS[n]}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <RatingDisplay value={answers[q.question_key] ?? ''} />
                )
              ) : isEditable ? (
                <textarea
                  rows={4}
                  className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent placeholder-gray-400"
                  placeholder={q.placeholder ?? ''}
                  value={String(answers[q.question_key] ?? '')}
                  onChange={(e) => handleTextChange(q.question_key, e.target.value)}
                  onBlur={() => handleTextBlur(q.question_key)}
                />
              ) : (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {answers[q.question_key] || <span className="text-gray-400">No response</span>}
                </div>
              )}
            </div>
          ))}

          {isEditable && (
            <div className="pt-2 pb-4">
              <button
                onClick={handleSignOff}
                disabled={submitting}
                className="w-full bg-brand-blue text-white rounded-xl py-3 text-sm font-medium hover:bg-[#006BB0] active:bg-[#005A96] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Signing off…' : 'Submit and sign off'}
              </button>
            </div>
          )}

          {signedOff && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-800">
              Review signed off. The employee has been notified.
            </div>
          )}

          {signedOff && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              {released ? (
                <p className="text-sm text-green-700 font-medium">Review released to employee.</p>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Release to {subjectName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">They will be able to view a PDF of this review.</p>
                  </div>
                  <button
                    onClick={handleRelease}
                    disabled={releasing}
                    className="shrink-0 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                  >
                    {releasing ? 'Releasing…' : `Release to ${subjectName.split(' ')[0]}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {signedOff && <BackToProfile token={managerToken} />}

          {/* Download PDF — bottom */}
          <div className="pb-4">
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Download PDF
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
