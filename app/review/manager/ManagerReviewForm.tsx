'use client';

import { useState } from 'react';
import { RATING_LABELS } from '@/lib/reviewQuestions';
import type { CycleQuestion, MemberGoal, TeamMemberRow } from '@/lib/db';

interface PeerReview {
  label: string;
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
  goals: MemberGoal[];
  allMembers: { token: string; name: string }[];
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

function ReadOnlyField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className="text-sm text-gray-800 whitespace-pre-wrap">
        {value !== '' && value !== undefined ? String(value) : <span className="text-gray-400">No response</span>}
      </div>
    </div>
  );
}

function RatingDisplay({ value }: { value: string | number }) {
  if (value === '' || value === undefined) return <span className="text-gray-400 text-sm">No response</span>;
  const n = Number(value);
  return <span className="text-sm text-gray-800">{RATING_LABELS[n] ?? String(value)}</span>;
}

function SharePanel({
  assignmentId,
  subjectToken,
  allMembers,
}: {
  assignmentId: number;
  subjectToken: string;
  allMembers: { token: string; name: string }[];
}) {
  const [sharedTokens, setSharedTokens] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadShares() {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/review/share?assignment=${assignmentId}`);
      if (res.ok) {
        const data = await res.json() as { shares: { recipient_token: string }[] };
        setSharedTokens(data.shares.map((s) => s.recipient_token));
      }
    } catch {
      setError('Failed to load shares');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  async function toggleShare(recipientToken: string, currentlyShared: boolean) {
    try {
      const method = currentlyShared ? 'DELETE' : 'POST';
      const res = await fetch('/api/review/share', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, recipient_token: recipientToken }),
      });
      if (!res.ok) throw new Error('Failed');
      setSharedTokens((prev) =>
        currentlyShared ? prev.filter((t) => t !== recipientToken) : [...prev, recipientToken],
      );
    } catch {
      setError('Failed to update sharing');
    }
  }

  // Available recipients: exclude the subject themselves
  const available = allMembers.filter((m) => m.token !== subjectToken);

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-700">Share this review</p>
        {!loaded && (
          <button
            onClick={loadShares}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {loading ? 'Loading…' : 'Load sharing settings'}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}

      {loaded ? (
        <div className="space-y-2">
          {available.map((member) => {
            const isShared = sharedTokens.includes(member.token);
            return (
              <label key={member.token} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={() => toggleShare(member.token, isShared)}
                  className="h-4 w-4 rounded border-gray-300 accent-gray-800 cursor-pointer"
                />
                <span className="text-sm text-gray-700">{member.name}</span>
              </label>
            );
          })}
          {available.length === 0 && (
            <p className="text-xs text-gray-400">No other team members to share with.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Click "Load sharing settings" to manage who can see this review.</p>
      )}
    </div>
  );
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
  allMembers,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    // Goal responses
    for (const goal of goals) {
      const progressKey = `goal_progress_${goal.id}`;
      const commentKey = `goal_comment_${goal.id}`;
      const progressRaw = existingResponses[progressKey];
      init[progressKey] = progressRaw !== undefined ? Number(progressRaw) : '';
      init[commentKey] = existingResponses[commentKey] ?? '';
    }
    // Question responses
    for (const q of questions) {
      const raw = existingResponses[q.question_key];
      init[q.question_key] = q.question_type === 'rating' && raw !== undefined ? Number(raw) : (raw ?? '');
    }
    return init;
  });
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
      // Save all fields
      const allKeys: string[] = [];
      for (const goal of goals) {
        allKeys.push(`goal_progress_${goal.id}`, `goal_comment_${goal.id}`);
      }
      for (const q of questions) {
        allKeys.push(q.question_key);
      }
      await Promise.all(allKeys.map((key) => saveField(key, answers[key] ?? '')));

      const res = await fetch('/api/review/signoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_id: cycleId,
          subject_token: subjectToken,
          assignment_id: assignmentId,
        }),
      });
      if (res.ok) {
        setSignedOff(true);
      }
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
      if (res.ok) {
        setReleased(true);
      }
    } catch {
      // silent failure
    } finally {
      setReleasing(false);
    }
  }

  if (signedOff && !isEditable) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Review signed off</h1>
          <p className="text-sm text-gray-500">The employee has been notified.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
            <h1 className="text-xl font-semibold text-gray-900">Manager review — {subjectName}</h1>
          </div>
          <a
            href={`/review/manager/print?cycle=${cycleId}&token=${managerToken}&subject=${subjectToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Download PDF
          </a>
        </div>

        <div className="space-y-4">
          {/* Self-review collapsible */}
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
                    <ReadOnlyField key={key} label={key} value={val} />
                  ))
              }
            </div>
          </Collapsible>

          {/* Peer feedback collapsible */}
          <Collapsible title={`Peer feedback (${peerReviews.length} reviewers)`}>
            <div className="space-y-6">
              {peerReviews.map((peer) => (
                <div key={peer.label}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">
                    {peer.label}
                  </h3>
                  <div className="space-y-3">
                    {questions.map((q) => (
                      <div key={q.question_key}>
                        <p className="text-xs font-medium text-gray-500 mb-1">{q.question_text}</p>
                        {q.question_type === 'rating' ? (
                          <RatingDisplay value={peer.responses[q.question_key] ?? ''} />
                        ) : (
                          <div className="text-sm text-gray-800 whitespace-pre-wrap">
                            {peer.responses[q.question_key] !== '' && peer.responses[q.question_key] !== undefined
                              ? String(peer.responses[q.question_key])
                              : <span className="text-gray-400">No response</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Collapsible>

          {/* Goals section */}
          {goals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-sm font-medium text-gray-700 mb-4">Goals</p>
              <div className="space-y-5">
                {goals.map((goal) => {
                  const progressKey = `goal_progress_${goal.id}`;
                  const commentKey = `goal_comment_${goal.id}`;
                  return (
                    <div key={goal.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <p className="text-sm text-gray-800 mb-3 font-medium">{goal.body}</p>
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">Progress assessment (1–5)</p>
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
                          <RatingDisplay value={answers[progressKey] ?? ''} />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Comment</p>
                        {isEditable ? (
                          <textarea
                            rows={3}
                            className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent placeholder-gray-400"
                            placeholder="Comment on this goal…"
                            value={String(answers[commentKey] ?? '')}
                            onChange={(e) => handleTextChange(commentKey, e.target.value)}
                            onBlur={() => handleTextBlur(commentKey)}
                          />
                        ) : (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {answers[commentKey] || <span className="text-gray-400">No comment</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manager review questions */}
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
                          className="w-4 h-4 accent-gray-800"
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
                  className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent placeholder-gray-400"
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
                className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 active:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

          {/* Release to employee */}
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
                    className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    {releasing ? 'Releasing…' : `Release to ${subjectName.split(' ')[0]}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Share panel — shown after sign-off */}
          {signedOff && (
            <div className="pb-8">
              <SharePanel
                assignmentId={assignmentId}
                subjectToken={subjectToken}
                allMembers={allMembers}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
