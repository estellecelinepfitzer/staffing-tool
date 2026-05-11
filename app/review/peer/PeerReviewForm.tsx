'use client';

import { useState } from 'react';
import { getPeerReviewHeadline, RATING_LABELS } from '@/lib/reviewQuestions';
import type { CycleQuestion } from '@/lib/db';

interface Props {
  cycleId: number;
  token: string;
  subjectToken: string;
  subjectName: string;
  cycleName: string;
  assignmentId: number;
  existingResponses: Record<string, string | number>;
  isEditable: boolean;
  questions: CycleQuestion[];
  managerToken?: string;
}

export default function PeerReviewForm({
  cycleId,
  token,
  subjectToken,
  subjectName,
  cycleName,
  assignmentId,
  existingResponses,
  isEditable,
  questions,
  managerToken,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    for (const q of questions) {
      if (q.question_type === 'rating' && existingResponses[q.question_key] !== undefined) {
        init[q.question_key] = Number(existingResponses[q.question_key]);
      } else {
        init[q.question_key] = existingResponses[q.question_key] ?? '';
      }
      const commentKey = `${q.question_key}_comment`;
      init[commentKey] = existingResponses[commentKey] ?? '';
    }
    return init;
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
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

  async function handleSave() {
    const missing = questions.filter(
      (q) => q.required === 1 && (answers[q.question_key] === '' || answers[q.question_key] === undefined),
    );
    if (missing.length > 0) {
      setValidationError(`Please fill in all required fields (*): ${missing.map((q) => q.question_text).join(', ')}`);
      return;
    }
    setValidationError(null);
    setSaving(true);
    try {
      await Promise.all([
        ...questions.filter((q) => q.question_type === 'text').map((q) =>
          saveField(q.question_key, answers[q.question_key] ?? ''),
        ),
        ...questions.filter((q) => q.question_type === 'rating').map((q) =>
          saveField(`${q.question_key}_comment`, answers[`${q.question_key}_comment`] ?? ''),
        ),
      ]);
      const res = await fetch('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      if (res.ok) {
        setSaved(true);
      }
    } catch {
      // silent failure
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Peer review submitted</h1>
          <p className="text-sm text-gray-500 mb-6">Thank you. Your peer review has been submitted successfully.</p>
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

  const pdfHref = managerToken
    ? `/review/manager/print?cycle=${cycleId}&token=${managerToken}&subject=${subjectToken}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
            <h1 className="text-xl font-semibold text-gray-900">Peer Review</h1>
            <p className="text-sm text-gray-500 mt-1">{getPeerReviewHeadline(subjectName)}</p>
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
          {questions.map((q) => (
            <div key={q.question_key} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {q.question_text}
                {q.required === 1 && <span className="text-gray-400 ml-1">*</span>}
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
                      onChange={(e) => handleTextChange(`${q.question_key}_comment`, e.target.value)}
                      onBlur={() => handleTextBlur(`${q.question_key}_comment`)}
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
            <div className="pt-2 pb-8 space-y-3">
              {validationError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{validationError}</p>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-brand-blue text-white rounded-xl py-3 text-sm font-medium hover:bg-[#006BB0] active:bg-[#005A96] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Save peer review'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
