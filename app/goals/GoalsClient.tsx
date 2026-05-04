'use client';

import { useState, useEffect } from 'react';

type Scale = 'rating_5' | 'percent_100';

interface CompanyGoal { id: number; title: string; description: string; sort_order: number; created_at: string; scale: Scale; }
interface PersonalGoal { id: number; member_token: string; body: string; description: string; company_goal_id: number | null; progress: number; sort_order: number; created_at: string; scale: Scale; }
interface TeamMember { token: string; name: string; }

interface Props {
  companyGoals: CompanyGoal[];
  personalGoals: PersonalGoal[];
  members: TeamMember[];
}

// Normalize any goal progress to 0–100 for rollup math
function toPercent(progress: number, scale: Scale): number {
  return scale === 'rating_5' ? (progress / 5) * 100 : progress;
}

function rollup(goals: PersonalGoal[]): number {
  if (goals.length === 0) return 0;
  const avg = goals.reduce((s, g) => s + toPercent(g.progress, g.scale), 0) / goals.length;
  return Math.round(avg);
}

function ScaleToggle({ value, onChange }: { value: Scale; onChange: (s: Scale) => void }) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange('percent_100')}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors border ${value === 'percent_100' ? 'bg-brand-blue text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
      >
        0–100%
      </button>
      <button
        type="button"
        onClick={() => onChange('rating_5')}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors border ${value === 'rating_5' ? 'bg-brand-blue text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
      >
        1–5
      </button>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function GoalsClient({ companyGoals: initCG, personalGoals: initPG, members }: Props) {
  const [companyGoals, setCompanyGoals] = useState<CompanyGoal[]>(initCG);
  const [personalGoals, setPersonalGoals] = useState<PersonalGoal[]>(initPG);
  const [error, setError] = useState<string | null>(null);

  // Company goal form
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyTitle, setNewCompanyTitle] = useState('');
  const [newCompanyDesc, setNewCompanyDesc] = useState('');
  const [newCompanyScale, setNewCompanyScale] = useState<Scale>('percent_100');
  const [addingCompany, setAddingCompany] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);

  // Personal goal form
  const [showAddPersonal, setShowAddPersonal] = useState<string | null>(null);
  const [newPersonalTitle, setNewPersonalTitle] = useState('');
  const [newPersonalDesc, setNewPersonalDesc] = useState('');
  const [newPersonalCompanyId, setNewPersonalCompanyId] = useState<number | null>(null);
  const [newPersonalScale, setNewPersonalScale] = useState<Scale>('percent_100');
  const [addingPersonal, setAddingPersonal] = useState(false);

  const memberMap = new Map(members.map((m) => [m.token, m.name]));

  // ── Company goal CRUD ──────────────────────────────────────────────────────

  async function handleAddCompanyGoal() {
    const title = newCompanyTitle.trim();
    if (!title) return;
    setAddingCompany(true);
    try {
      const sortOrder = companyGoals.length;
      const res = await fetch('/api/admin/goals/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: newCompanyDesc.trim(), sort_order: sortOrder, scale: newCompanyScale }),
      });
      const data = await res.json() as { id: number };
      setCompanyGoals((p) => [...p, { id: data.id, title, description: newCompanyDesc.trim(), sort_order: sortOrder, scale: newCompanyScale, created_at: new Date().toISOString() }]);
      setNewCompanyTitle('');
      setNewCompanyDesc('');
      setNewCompanyScale('percent_100');
      setShowAddCompany(false);
    } catch { setError('Failed to add company goal'); }
    finally { setAddingCompany(false); }
  }

  async function handleUpdateCompanyGoal(id: number, updates: Partial<CompanyGoal>) {
    await fetch(`/api/admin/goals/company/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setCompanyGoals((p) => p.map((g) => g.id === id ? { ...g, ...updates } : g));
    setEditingCompanyId(null);
  }

  async function handleDeleteCompanyGoal(id: number, title: string) {
    if (!confirm(`Delete company goal "${title}"? Personal goals linked to it will be unlinked.`)) return;
    await fetch(`/api/admin/goals/company/${id}`, { method: 'DELETE' });
    setCompanyGoals((p) => p.filter((g) => g.id !== id));
    setPersonalGoals((p) => p.map((g) => g.company_goal_id === id ? { ...g, company_goal_id: null } : g));
  }

  // ── Personal goal CRUD ─────────────────────────────────────────────────────

  async function handleAddPersonalGoal(memberToken: string) {
    const title = newPersonalTitle.trim();
    if (!title) return;
    setAddingPersonal(true);
    try {
      const res = await fetch(`/api/admin/members/${memberToken}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: title }),
      });
      const data = await res.json() as { id: number };
      const newGoal: PersonalGoal = {
        id: data.id, member_token: memberToken, body: title,
        description: newPersonalDesc.trim(), company_goal_id: newPersonalCompanyId,
        progress: 0, scale: newPersonalScale, sort_order: 0, created_at: new Date().toISOString(),
      };
      await fetch(`/api/admin/members/${memberToken}/goals/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newPersonalDesc.trim(), company_goal_id: newPersonalCompanyId, scale: newPersonalScale }),
      });
      setPersonalGoals((p) => [...p, newGoal]);
      setNewPersonalTitle('');
      setNewPersonalDesc('');
      setNewPersonalCompanyId(null);
      setNewPersonalScale('percent_100');
      setShowAddPersonal(null);
    } catch { setError('Failed to add personal goal'); }
    finally { setAddingPersonal(false); }
  }

  async function handleUpdatePersonalGoal(goal: PersonalGoal, patch: Partial<PersonalGoal>) {
    await fetch(`/api/admin/members/${goal.member_token}/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setPersonalGoals((p) => p.map((g) => g.id === goal.id ? { ...g, ...patch } : g));
  }

  async function handleDeletePersonalGoal(goal: PersonalGoal) {
    if (!confirm(`Delete goal "${goal.body}"?`)) return;
    await fetch(`/api/admin/members/${goal.member_token}/goals/${goal.id}`, { method: 'DELETE' });
    setPersonalGoals((p) => p.filter((g) => g.id !== goal.id));
  }

  const unlinkedGoals = personalGoals.filter((g) => !g.company_goal_id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mtip-logo.png" alt="MTIP" className="h-7 w-auto" />
            <h1 className="text-xl font-semibold text-gray-900">Goals</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">← Admin</a>
            <a href="/dashboard" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Dashboard</a>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error} <button className="underline ml-2" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Company goals */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Company Goals</h2>
            <button
              onClick={() => setShowAddCompany(true)}
              className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              + Add goal
            </button>
          </div>

          {showAddCompany && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-3">
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  value={newCompanyTitle}
                  onChange={(e) => setNewCompanyTitle(e.target.value)}
                  placeholder="Goal title"
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  autoFocus
                />
                <textarea
                  value={newCompanyDesc}
                  onChange={(e) => setNewCompanyDesc(e.target.value)}
                  rows={2}
                  placeholder="Description (optional)"
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Progress scale:</span>
                  <ScaleToggle value={newCompanyScale} onChange={setNewCompanyScale} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCompanyGoal}
                  disabled={addingCompany || !newCompanyTitle.trim()}
                  className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                >
                  {addingCompany ? '…' : 'Add company goal'}
                </button>
                <button onClick={() => setShowAddCompany(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {companyGoals.length === 0 && <p className="text-sm text-gray-400">No company goals yet.</p>}
            {companyGoals.map((cg) => {
              const linked = personalGoals.filter((g) => g.company_goal_id === cg.id);
              const avg = rollup(linked);
              const isEditing = editingCompanyId === cg.id;
              return (
                <div key={cg.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4">
                    {isEditing ? (
                      <CompanyGoalEditForm
                        goal={cg}
                        onSave={(updates) => handleUpdateCompanyGoal(cg.id, updates)}
                        onCancel={() => setEditingCompanyId(null)}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{cg.title}</p>
                          {cg.description && <p className="text-xs text-gray-500 mt-0.5">{cg.description}</p>}
                          {linked.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-400 mb-1">Avg progress ({linked.length} goal{linked.length !== 1 ? 's' : ''})</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-gray-800 rounded-full transition-all" style={{ width: `${avg}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 shrink-0 w-10 text-right">{avg}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setEditingCompanyId(cg.id)} className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-1">Edit</button>
                          <button onClick={() => handleDeleteCompanyGoal(cg.id, cg.title)} className="text-xs text-red-400 hover:text-red-600 underline underline-offset-1">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {linked.length > 0 && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {linked.map((pg) => (
                        <PersonalGoalRow
                          key={pg.id}
                          goal={pg}
                          memberName={memberMap.get(pg.member_token) ?? pg.member_token}
                          companyGoals={companyGoals}
                          onProgressChange={(v) => handleUpdatePersonalGoal(pg, { progress: v })}
                          onScaleChange={(s) => handleUpdatePersonalGoal(pg, { scale: s })}
                          onLink={(cgId) => handleUpdatePersonalGoal(pg, { company_goal_id: cgId })}
                          onDelete={() => handleDeletePersonalGoal(pg)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Personal goals by member */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Personal Goals</h2>
          <div className="space-y-4">
            {members.map((member) => {
              const memberGoals = personalGoals.filter((g) => g.member_token === member.token);
              const isAddOpen = showAddPersonal === member.token;
              return (
                <div key={member.token} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-700">{member.name}</span>
                    <button
                      onClick={() => setShowAddPersonal(isAddOpen ? null : member.token)}
                      className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-1"
                    >
                      {isAddOpen ? 'Cancel' : '+ Add goal'}
                    </button>
                  </div>

                  {isAddOpen && (
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
                      <input
                        type="text"
                        value={newPersonalTitle}
                        onChange={(e) => setNewPersonalTitle(e.target.value)}
                        placeholder="Goal title"
                        className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        autoFocus
                      />
                      <textarea
                        value={newPersonalDesc}
                        onChange={(e) => setNewPersonalDesc(e.target.value)}
                        rows={2}
                        placeholder="Description (optional)"
                        className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      />
                      <div className="flex items-center gap-3 flex-wrap">
                        <select
                          value={newPersonalCompanyId ?? ''}
                          onChange={(e) => setNewPersonalCompanyId(e.target.value ? Number(e.target.value) : null)}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        >
                          <option value="">— no company goal —</option>
                          {companyGoals.map((cg) => <option key={cg.id} value={cg.id}>{cg.title}</option>)}
                        </select>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Scale:</span>
                          <ScaleToggle value={newPersonalScale} onChange={setNewPersonalScale} />
                        </div>
                        <button
                          onClick={() => handleAddPersonalGoal(member.token)}
                          disabled={addingPersonal || !newPersonalTitle.trim()}
                          className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                        >
                          {addingPersonal ? '…' : 'Add'}
                        </button>
                      </div>
                    </div>
                  )}

                  {memberGoals.length === 0 && !isAddOpen && (
                    <p className="px-5 py-3 text-xs text-gray-400">No goals set.</p>
                  )}

                  {memberGoals.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {memberGoals.map((pg) => (
                        <PersonalGoalRow
                          key={pg.id}
                          goal={pg}
                          memberName=""
                          companyGoals={companyGoals}
                          onProgressChange={(v) => handleUpdatePersonalGoal(pg, { progress: v })}
                          onScaleChange={(s) => handleUpdatePersonalGoal(pg, { scale: s })}
                          onLink={(cgId) => handleUpdatePersonalGoal(pg, { company_goal_id: cgId })}
                          onDelete={() => handleDeletePersonalGoal(pg)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {unlinkedGoals.length > 0 && (
          <div className="mt-6 text-xs text-gray-400 text-center">
            {unlinkedGoals.length} personal goal{unlinkedGoals.length !== 1 ? 's' : ''} not linked to any company goal
          </div>
        )}
      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function CompanyGoalEditForm({ goal, onSave, onCancel }: {
  goal: CompanyGoal;
  onSave: (updates: Partial<CompanyGoal>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [desc, setDesc] = useState(goal.description);
  const [scale, setScale] = useState<Scale>(goal.scale);
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="block w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-teal"
        autoFocus
      />
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={2}
        placeholder="Description (optional)"
        className="block w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Progress scale:</span>
        <ScaleToggle value={scale} onChange={setScale} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ title: title.trim(), description: desc.trim(), scale })} disabled={!title.trim()} className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors">Save</button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
    </div>
  );
}

function PersonalGoalRow({ goal, memberName, companyGoals, onProgressChange, onScaleChange, onLink, onDelete }: {
  goal: PersonalGoal;
  memberName: string;
  companyGoals: { id: number; title: string }[];
  onProgressChange: (v: number) => void;
  onScaleChange: (s: Scale) => void;
  onLink: (cgId: number | null) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localProgress, setLocalProgress] = useState(goal.progress);
  const [isDragging, setIsDragging] = useState(false);

  // Sync local slider with parent state (handles updates from other views)
  useEffect(() => {
    if (!isDragging) setLocalProgress(goal.progress);
  }, [goal.progress, isDragging]);

  function handleProgressCommit(v: number) {
    setLocalProgress(v);
    setIsDragging(false);
    onProgressChange(v);
  }

  return (
    <div className="px-5 py-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          {memberName && <p className="text-xs text-gray-400 mb-0.5">{memberName}</p>}
          <p className="text-sm text-gray-800">{goal.body}</p>
          {goal.description && <p className="text-xs text-gray-500 mt-0.5">{goal.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setEditing((p) => !p)} className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-1">
            {editing ? 'Done' : 'Edit'}
          </button>
          <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 underline underline-offset-1">Delete</button>
        </div>
      </div>

      {/* Progress input */}
      {goal.scale === 'percent_100' ? (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={localProgress}
            onChange={(e) => { setIsDragging(true); setLocalProgress(Number(e.target.value)); }}
            onMouseUp={(e) => handleProgressCommit(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => handleProgressCommit(Number((e.target as HTMLInputElement).value))}
            className="flex-1 accent-[#0080C8]"
          />
          <span className="text-xs text-gray-500 w-10 text-right">{localProgress}%</span>
        </div>
      ) : (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => handleProgressCommit(n)}
              className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${localProgress === n ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Edit panel */}
      {editing && (
        <div className="mt-3 space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Scale:</span>
            <ScaleToggle value={goal.scale} onChange={onScaleChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Link to company goal</label>
            <select
              value={goal.company_goal_id ?? ''}
              onChange={(e) => onLink(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <option value="">— none —</option>
              {companyGoals.map((cg) => <option key={cg.id} value={cg.id}>{cg.title}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
