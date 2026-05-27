'use client';

import { useState, useRef } from 'react';
import type { CycleQuestion } from '@/lib/db';

interface Props {
  cycleId: number;
  reviewType: 'self' | 'peer' | 'manager';
  initialQuestions: CycleQuestion[];
  isLocked: boolean;
}

export default function QuestionsPanel({ cycleId, reviewType, initialQuestions, isLocked }: Props) {
  const [questions, setQuestions] = useState<CycleQuestion[]>(initialQuestions);
  const [error, setError] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'text' | 'rating'>('text');
  const [savingNew, setSavingNew] = useState(false);

  async function handleMove(index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= questions.length) return;
    const next = [...questions];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setQuestions(next);
    try {
      await fetch(`/api/admin/reviews/${cycleId}/questions/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: next.map((q, i) => ({ id: q.id, sort_order: i })) }),
      });
    } catch {
      setError('Failed to save order');
    }
  }

  async function handleUpdateQuestion(id: number, question_text: string) {
    try {
      await fetch(`/api/admin/reviews/${cycleId}/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text }),
      });
      setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, question_text } : q));
    } catch {
      setError('Failed to save question');
    }
  }

  async function handleDeleteQuestion(id: number) {
    if (!confirm('Delete this question?')) return;
    try {
      await fetch(`/api/admin/reviews/${cycleId}/questions/${id}`, { method: 'DELETE' });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch {
      setError('Failed to delete question');
    }
  }

  async function handleAddQuestion() {
    if (!newText.trim()) return;
    setSavingNew(true);
    try {
      const res = await fetch(`/api/admin/reviews/${cycleId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_type: reviewType, question_text: newText.trim(), question_type: newType }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { id: number };
      const newQ: CycleQuestion = {
        id: data.id,
        cycle_id: cycleId,
        review_type: reviewType,
        question_key: `custom_${data.id}`,
        question_text: newText.trim(),
        question_type: newType,
        placeholder: null,
        required: 1,
        sort_order: 999,
      };
      setQuestions((prev) => [...prev, newQ]);
      setNewText('');
      setNewType('text');
      setAddingNew(false);
    } catch {
      setError('Failed to add question');
    } finally {
      setSavingNew(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button className="underline ml-2" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {questions.length === 0 && <p className="text-xs text-gray-400">No questions defined.</p>}

      <div className="space-y-2">
        {questions.map((q, idx) => (
          <QuestionRow
            key={q.id}
            question={q}
            index={idx + 1}
            isFirst={idx === 0}
            isLast={idx === questions.length - 1}
            isLocked={isLocked}
            onSave={(text) => handleUpdateQuestion(q.id, text)}
            onDelete={() => handleDeleteQuestion(q.id)}
            onMoveUp={() => handleMove(idx, 'up')}
            onMoveDown={() => handleMove(idx, 'down')}
          />
        ))}
      </div>

      {!isLocked && (
        <>
          {addingNew ? (
            <div className="flex gap-2 items-start pt-1">
              <div className="flex-1 space-y-2">
                <textarea
                  autoFocus
                  rows={2}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Enter question text…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                    <input
                      type="radio"
                      name="newQuestionType"
                      value="text"
                      checked={newType === 'text'}
                      onChange={() => setNewType('text')}
                      className="h-3.5 w-3.5"
                    />
                    Question (text)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                    <input
                      type="radio"
                      name="newQuestionType"
                      value="rating"
                      checked={newType === 'rating'}
                      onChange={() => setNewType('rating')}
                      className="h-3.5 w-3.5"
                    />
                    Rating (1–5)
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={handleAddQuestion}
                  disabled={savingNew || !newText.trim()}
                  className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                >
                  {savingNew ? '…' : 'Add'}
                </button>
                <button
                  onClick={() => { setAddingNew(false); setNewText(''); setNewType('text'); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              + Add question
            </button>
          )}
        </>
      )}

    </div>
  );
}

function QuestionRow({
  question,
  index,
  isFirst,
  isLast,
  isLocked,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: CycleQuestion;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isLocked: boolean;
  onSave: (text: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [text, setText] = useState(question.question_text);
  const savedRef = useRef(question.question_text);

  function handleBlur() {
    if (text.trim() !== savedRef.current) {
      savedRef.current = text.trim();
      onSave(text.trim());
    }
  }

  return (
    <div className="flex gap-2 items-start">
      {/* Up / down arrows */}
      <div className="flex flex-col mt-1.5 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-0 disabled:cursor-default transition-colors"
          title="Move up"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-0 disabled:cursor-default transition-colors"
          title="Move down"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <span className="text-xs text-gray-400 mt-2.5 w-5 shrink-0 text-right">{index}.</span>

      <div className="flex-1 flex gap-2 items-start">
        {isLocked ? (
          <div className="flex-1 text-sm text-gray-700 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
            {text}
          </div>
        ) : (
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
          />
        )}
        <span className={`mt-2 text-xs px-1.5 py-0.5 rounded shrink-0 ${
          question.question_type === 'rating'
            ? 'bg-purple-50 text-purple-700 border border-purple-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200'
        }`}>
          {question.question_type}
        </span>
        {!isLocked && (
          <button
            onClick={onDelete}
            className="mt-2 text-gray-300 hover:text-red-500 transition-colors text-lg leading-none shrink-0"
            title="Delete question"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
