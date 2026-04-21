'use client';

import { useState } from 'react';
import {
  SELF_REVIEW_QUESTIONS,
  SELF_REVIEW_HEADLINE,
  SELF_GOALS_KEY,
} from '@/lib/reviewQuestions';

interface Props {
  cycleId: number;
  token: string;
  cycleName: string;
  assignmentId: number;
  existingResponses: Record<string, string>;
  isEditable: boolean;
}

export default function SelfReviewForm({
  assignmentId,
  cycleName,
  existingResponses,
  isEditable,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({
    [SELF_GOALS_KEY]: existingResponses[SELF_GOALS_KEY] ?? '',
    ...Object.fromEntries(
      SELF_REVIEW_QUESTIONS.map((q) => [q.key, existingResponses[q.key] ?? '']),
    ),
  }));
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function saveField(key: string, value: string) {
    try {
      await fetch('/api/review/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          question_key: key,
          answer_text: value,
        }),
      });
    } catch {
      // silent failure
    }
  }

  function handleChange(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleBlur(key: string) {
    await saveField(key, answers[key] ?? '');
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Save all fields first
      await Promise.all(
        [SELF_GOALS_KEY, ...SELF_REVIEW_QUESTIONS.map((q) => q.key)].map((key) =>
          saveField(key, answers[key] ?? ''),
        ),
      );
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

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
          <h1 className="text-xl font-semibold text-gray-900">Self-Review</h1>
          <p className="text-sm text-gray-500 mt-1">{SELF_REVIEW_HEADLINE}</p>
        </div>

        <div className="space-y-5">
          {/* Goals section */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Goals &amp; progress
            </label>
            {isEditable ? (
              <textarea
                rows={5}
                className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent placeholder-gray-400"
                placeholder="Reflect on your goals and progress over the past year…"
                value={answers[SELF_GOALS_KEY]}
                onChange={(e) => handleChange(SELF_GOALS_KEY, e.target.value)}
                onBlur={() => handleBlur(SELF_GOALS_KEY)}
              />
            ) : (
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {answers[SELF_GOALS_KEY] || <span className="text-gray-400">No response</span>}
              </div>
            )}
          </div>

          {/* Main questions */}
          {SELF_REVIEW_QUESTIONS.map((q) => (
            <div key={q.key} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {q.text}
                {q.required && <span className="text-gray-400 ml-1">*</span>}
              </label>
              {isEditable ? (
                <textarea
                  rows={4}
                  className="block w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent placeholder-gray-400"
                  placeholder={q.placeholder ?? ''}
                  value={answers[q.key]}
                  onChange={(e) => handleChange(q.key, e.target.value)}
                  onBlur={() => handleBlur(q.key)}
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
