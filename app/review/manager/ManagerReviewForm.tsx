'use client';

import { useState } from 'react';
import {
  MANAGER_REVIEW_QUESTIONS,
  SELF_REVIEW_QUESTIONS,
  RATING_LABELS,
  goalCommentKey,
  SELF_GOALS_KEY,
} from '@/lib/reviewQuestions';

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

export default function ManagerReviewForm({
  cycleId,
  subjectToken,
  subjectName,
  cycleName,
  assignmentId,
  existingResponses,
  selfReviewResponses,
  peerReviews,
  selfGoals,
  isEditable,
  isSignedOff,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string | number>>(() =>
    Object.fromEntries(
      [
        goalCommentKey(0),
        ...MANAGER_REVIEW_QUESTIONS.map((q) => q.key),
      ].map((key) => [key, existingResponses[key] ?? '']),
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [signedOff, setSignedOff] = useState(isSignedOff);

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
      // Save all fields first
      await Promise.all(
        [goalCommentKey(0), ...MANAGER_REVIEW_QUESTIONS.map((q) => q.key)].map((key) => {
          const val = answers[key];
          return saveField(key, val ?? '');
        }),
      );

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
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
          <h1 className="text-xl font-semibold text-gray-900">Manager review — {subjectName}</h1>
        </div>

        <div className="space-y-4">
          {/* Self-review collapsible */}
          <Collapsible title="Self-review">
            <div className="space-y-4">
              <ReadOnlyField label="Goals & progress" value={selfGoals} />
              {SELF_REVIEW_QUESTIONS.map((q) => (
                <ReadOnlyField
                  key={q.key}
                  label={q.text}
                  value={selfReviewResponses[q.key] ?? ''}
                />
              ))}
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
                    {MANAGER_REVIEW_QUESTIONS.map((q) => (
                      <div key={q.key}>
                        <p className="text-xs font-medium text-gray-500 mb-1">{q.text}</p>
                        {q.type === 'rating' ? (
                          <RatingDisplay value={peer.responses[q.key] ?? ''} />
                        ) : (
                          <div className="text-sm text-gray-800 whitespace-pre-wrap">
                            {peer.responses[q.key] !== '' && peer.responses[q.key] !== undefined
                              ? String(peer.responses[q.key])
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

          {/* Goal comments */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your comments on their goals
            </label>
            {isEditable ? (
              <textarea
                rows={4}
                className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent placeholder-gray-400"
                placeholder="Comment on the employee's goals and progress…"
                value={String(answers[goalCommentKey(0)] ?? '')}
                onChange={(e) => handleTextChange(goalCommentKey(0), e.target.value)}
                onBlur={() => handleTextBlur(goalCommentKey(0))}
              />
            ) : (
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {answers[goalCommentKey(0)] || <span className="text-gray-400">No response</span>}
              </div>
            )}
          </div>

          {/* Manager review questions */}
          {MANAGER_REVIEW_QUESTIONS.map((q) => (
            <div key={q.key} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {q.text}
                {q.required && <span className="text-gray-400 ml-1">*</span>}
              </label>

              {q.type === 'rating' ? (
                isEditable ? (
                  <div className="flex gap-3 flex-wrap">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={q.key}
                          value={n}
                          checked={answers[q.key] === n}
                          onChange={() => handleRatingChange(q.key, n)}
                          className="w-4 h-4 accent-gray-800"
                        />
                        <span className="text-xs text-gray-500 text-center max-w-[80px]">
                          {RATING_LABELS[n]}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <RatingDisplay value={answers[q.key] ?? ''} />
                )
              ) : isEditable ? (
                <textarea
                  rows={4}
                  className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent placeholder-gray-400"
                  placeholder={q.placeholder ?? ''}
                  value={String(answers[q.key] ?? '')}
                  onChange={(e) => handleTextChange(q.key, e.target.value)}
                  onBlur={() => handleTextBlur(q.key)}
                />
              ) : (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {answers[q.key] || <span className="text-gray-400">No response</span>}
                </div>
              )}
            </div>
          ))}

          {isEditable && (
            <div className="pt-2 pb-8">
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
        </div>
      </div>
    </div>
  );
}
