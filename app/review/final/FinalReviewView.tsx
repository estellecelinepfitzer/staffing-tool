'use client';

import { useState } from 'react';
import { MANAGER_REVIEW_QUESTIONS, RATING_LABELS, goalCommentKey } from '@/lib/reviewQuestions';

interface Props {
  cycleId: number;
  subjectToken: string;
  cycleName: string;
  subjectName: string;
  responses: Record<string, string | number>;
  acknowledgedAt: string | null;
}

function RatingDisplay({ value }: { value: string | number }) {
  if (value === '' || value === undefined) return <span className="text-gray-400 text-sm">No response</span>;
  const n = Number(value);
  return <span className="text-sm text-gray-800">{RATING_LABELS[n] ?? String(value)}</span>;
}

export default function FinalReviewView({
  cycleId,
  subjectToken,
  cycleName,
  subjectName,
  responses,
  acknowledgedAt,
}: Props) {
  const [acked, setAcked] = useState(!!acknowledgedAt);
  const [ackedAt, setAckedAt] = useState<string | null>(acknowledgedAt);
  const [loading, setLoading] = useState(false);

  async function handleAcknowledge() {
    setLoading(true);
    try {
      const res = await fetch('/api/review/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId, subject_token: subjectToken }),
      });
      if (res.ok) {
        setAcked(true);
        setAckedAt(new Date().toISOString());
      }
    } catch {
      // silent failure
    } finally {
      setLoading(false);
    }
  }

  const firstName = subjectName.split(' ')[0];

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
          <h1 className="text-xl font-semibold text-gray-900">Your review — {firstName}</h1>
          <p className="text-sm text-gray-500 mt-1">This is the manager review written for you.</p>
        </div>

        <div className="space-y-4">
          {/* Goal comments */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Manager comments on your goals</p>
            <div className="text-sm text-gray-800 whitespace-pre-wrap">
              {responses[goalCommentKey(0)] !== '' && responses[goalCommentKey(0)] !== undefined
                ? String(responses[goalCommentKey(0)])
                : <span className="text-gray-400">No comment</span>}
            </div>
          </div>

          {/* Manager review questions */}
          {MANAGER_REVIEW_QUESTIONS.map((q) => (
            <div key={q.key} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs font-medium text-gray-500 mb-2">{q.text}</p>
              {q.type === 'rating' ? (
                <RatingDisplay value={responses[q.key] ?? ''} />
              ) : (
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {responses[q.key] !== '' && responses[q.key] !== undefined
                    ? String(responses[q.key])
                    : <span className="text-gray-400">No response</span>}
                </div>
              )}
            </div>
          ))}

          {/* Acknowledgement */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            {acked ? (
              <p className="text-sm text-green-700">
                Acknowledged on{' '}
                {ackedAt
                  ? new Date(ackedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : ''}
              </p>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Please acknowledge that you have read and understood this review.
                </p>
                <button
                  onClick={handleAcknowledge}
                  disabled={loading}
                  className="bg-gray-900 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-700 active:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Acknowledging…' : 'I acknowledge this review'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
