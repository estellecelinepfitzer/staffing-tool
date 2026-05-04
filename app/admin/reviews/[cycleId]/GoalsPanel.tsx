'use client';

import { useState, useEffect, useRef } from 'react';
import type { TeamMemberRow, CycleGoal } from '@/lib/db';

interface Props {
  cycleId: number;
  members: TeamMemberRow[];
}

export default function GoalsPanel({ cycleId, members }: Props) {
  const [goalsByMember, setGoalsByMember] = useState<Record<string, CycleGoal[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newGoalText, setNewGoalText] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const results = await Promise.all(
          members.map(async (m) => {
            const res = await fetch(`/api/admin/reviews/${cycleId}/goals?subject=${m.token}`);
            if (!res.ok) return { token: m.token, goals: [] as CycleGoal[] };
            const data = await res.json() as { goals: CycleGoal[] };
            return { token: m.token, goals: data.goals };
          }),
        );
        const map: Record<string, CycleGoal[]> = {};
        for (const { token, goals } of results) {
          map[token] = goals;
        }
        setGoalsByMember(map);
      } catch {
        setError('Failed to load goals');
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [cycleId, members]);

  async function handleAddGoal(subjectToken: string) {
    if (!newGoalText.trim()) return;
    setSavingNew(true);
    try {
      const res = await fetch(`/api/admin/reviews/${cycleId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_token: subjectToken, body: newGoalText.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { id: number };
      const newGoal: CycleGoal = {
        id: data.id,
        cycle_id: cycleId,
        subject_token: subjectToken,
        body: newGoalText.trim(),
        sort_order: 0,
        created_at: new Date().toISOString(),
      };
      setGoalsByMember((prev) => ({
        ...prev,
        [subjectToken]: [...(prev[subjectToken] ?? []), newGoal],
      }));
      setNewGoalText('');
      setAddingFor(null);
    } catch {
      setError('Failed to add goal');
    } finally {
      setSavingNew(false);
    }
  }

  async function handleUpdateGoal(goalId: number, subjectToken: string, body: string) {
    try {
      await fetch(`/api/admin/reviews/${cycleId}/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      setGoalsByMember((prev) => ({
        ...prev,
        [subjectToken]: prev[subjectToken]?.map((g) =>
          g.id === goalId ? { ...g, body } : g,
        ) ?? [],
      }));
    } catch {
      setError('Failed to save goal');
    }
  }

  async function handleDeleteGoal(goalId: number, subjectToken: string) {
    try {
      await fetch(`/api/admin/reviews/${cycleId}/goals/${goalId}`, { method: 'DELETE' });
      setGoalsByMember((prev) => ({
        ...prev,
        [subjectToken]: prev[subjectToken]?.filter((g) => g.id !== goalId) ?? [],
      }));
    } catch {
      setError('Failed to delete goal');
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading goals…</p>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button className="underline ml-2" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {members.map((member) => {
        const goals = goalsByMember[member.token] ?? [];
        const isAddingHere = addingFor === member.token;

        return (
          <div key={member.token} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
            <p className="text-sm font-medium text-gray-900 mb-2">{member.name}</p>

            {goals.length === 0 && !isAddingHere && (
              <p className="text-xs text-gray-400 mb-2">No goals set</p>
            )}

            <div className="space-y-2 mb-2">
              {goals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onSave={(body) => handleUpdateGoal(goal.id, member.token, body)}
                  onDelete={() => handleDeleteGoal(goal.id, member.token)}
                />
              ))}
            </div>

            {isAddingHere ? (
              <div className="flex gap-2 items-start">
                <textarea
                  autoFocus
                  rows={2}
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder="Enter goal…"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => handleAddGoal(member.token)}
                    disabled={savingNew || !newGoalText.trim()}
                    className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                  >
                    {savingNew ? '…' : 'Add'}
                  </button>
                  <button
                    onClick={() => { setAddingFor(null); setNewGoalText(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setAddingFor(member.token); setNewGoalText(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                + Add goal
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GoalRow({
  goal,
  onSave,
  onDelete,
}: {
  goal: CycleGoal;
  onSave: (body: string) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(goal.body);
  const savedRef = useRef(goal.body);

  function handleBlur() {
    if (text.trim() !== savedRef.current) {
      savedRef.current = text.trim();
      onSave(text.trim());
    }
  }

  return (
    <div className="flex gap-2 items-start">
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
      />
      <button
        onClick={onDelete}
        className="mt-1 text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
        title="Delete goal"
      >
        ×
      </button>
    </div>
  );
}
