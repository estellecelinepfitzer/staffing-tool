'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ReviewCycle,
  CycleStatus,
  ReviewAssignment,
  ReviewSignoff,
  TeamMemberRow,
  CycleQuestion,
} from '@/lib/db';
import QuestionsPanel from './QuestionsPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  cycle: ReviewCycle;
  members: TeamMemberRow[];
  assignments: ReviewAssignment[];
  signoffs: ReviewSignoff[];
  selfQuestions: CycleQuestion[];
  peerQuestions: CycleQuestion[];
  managerQuestions: CycleQuestion[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CycleStatus, string> = {
  draft: 'Draft',
  self_review_open: 'Self Review Open',
  peer_review_open: 'Peer Review Open',
  manager_review_open: 'Manager Review Open',
  closed: 'Closed',
};

const STATUS_COLORS: Record<CycleStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  self_review_open: 'bg-blue-50 text-blue-700',
  peer_review_open: 'bg-purple-50 text-purple-700',
  manager_review_open: 'bg-orange-50 text-orange-700',
  closed: 'bg-green-50 text-green-700',
};

const STATUS_ORDER: CycleStatus[] = [
  'draft',
  'self_review_open',
  'peer_review_open',
  'manager_review_open',
  'closed',
];

function nextStatus(status: CycleStatus): CycleStatus | null {
  const idx = STATUS_ORDER.indexOf(status);
  return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
}

function prevStatus(status: CycleStatus): CycleStatus | null {
  const idx = STATUS_ORDER.indexOf(status);
  return idx > 0 ? STATUS_ORDER[idx - 1] : null;
}

const ADVANCE_LABELS: Partial<Record<CycleStatus, string>> = {
  self_review_open: 'Release self-reviews',
  peer_review_open: 'Release peer reviews',
  manager_review_open: 'Release manager reviews',
  closed: 'Close cycle',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function CycleClient({ cycle: initialCycle, members, assignments: initialAssignments, signoffs, selfQuestions, peerQuestions, managerQuestions }: Props) {
  const [cycle, setCycle] = useState<ReviewCycle>(initialCycle);
  const [assignments, setAssignments] = useState<ReviewAssignment[]>(initialAssignments);
  const [membersList, setMembersList] = useState<TeamMemberRow[]>(members);
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [reminding, setReminding] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const cycleId = cycle.id;

  // ── Peer add state ──
  const [addingPeerFor, setAddingPeerFor] = useState<string | null>(null);
  const [peerSelectValue, setPeerSelectValue] = useState('');
  const [peerAddLoading, setPeerAddLoading] = useState(false);

  // ── Header field auto-save ──
  async function handleFieldBlur(field: 'name' | 'self_due' | 'peer_due' | 'manager_due', value: string) {
    const patch: Partial<Pick<ReviewCycle, 'name' | 'self_due' | 'peer_due' | 'manager_due'>> = {};
    patch[field] = value || null as unknown as string;
    try {
      await fetch(`/api/admin/reviews/${cycleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch {
      setError('Failed to save field');
    }
  }

  // ── Manager change ──
  async function handleManagerChange(token: string, managerToken: string) {
    try {
      const res = await fetch(`/api/admin/team/${token}/manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: managerToken }),
      });
      if (!res.ok) throw new Error('Failed');
      setMembersList((prev) =>
        prev.map((m) => (m.token === token ? { ...m, manager_token: managerToken } : m)),
      );
    } catch {
      setError('Failed to update manager');
    }
  }

  // ── Peer add ──
  async function handleAddPeer(subjectToken: string, reviewerToken: string) {
    if (!reviewerToken) return;
    setPeerAddLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews/${cycleId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_token: reviewerToken, subject_token: subjectToken, type: 'peer' }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { assignment: ReviewAssignment };
      setAssignments((prev) => {
        // Replace if exists (it may have been soft-deleted before), else add
        const exists = prev.find((a) => a.id === data.assignment.id);
        if (exists) return prev.map((a) => (a.id === data.assignment.id ? data.assignment : a));
        return [...prev, data.assignment];
      });
      setAddingPeerFor(null);
      setPeerSelectValue('');
    } catch {
      setError('Failed to add peer reviewer');
    } finally {
      setPeerAddLoading(false);
    }
  }

  // ── Peer remove ──
  async function handleRemovePeer(assignmentId: number) {
    try {
      const res = await fetch(`/api/admin/reviews/${cycleId}/assignments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      if (!res.ok) throw new Error('Failed');
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, removed: 1 } : a)),
      );
    } catch {
      setError('Failed to remove peer reviewer');
    }
  }

  // ── Phase advance/revert ──
  async function handlePhase(status: CycleStatus) {
    const label = STATUS_LABELS[status];
    if (
      !confirm(
        `Set cycle to "${label}"? This will send notification emails to the team.`,
      )
    )
      return;
    setPhaseLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${cycleId}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Failed to update phase');
      }
      setCycle((c) => ({ ...c, status }));
      if (status === 'closed') {
        router.push('/admin');
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update phase');
    } finally {
      setPhaseLoading(false);
    }
  }

  // ── Remind ──
  async function handleRemind(token: string) {
    setReminding((r) => ({ ...r, [token]: true }));
    try {
      const res = await fetch(`/api/admin/reviews/${cycleId}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error('Failed to send reminder');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reminder');
    } finally {
      setReminding((r) => ({ ...r, [token]: false }));
    }
  }

  // ─── Derived data ───────────────────────────────────────────────────────────

  const isDraft = cycle.status === 'draft';
  const next = nextStatus(cycle.status);
  const prev = prevStatus(cycle.status);

  const activePeerAssignments = assignments.filter(
    (a) => a.type === 'peer' && a.removed === 0,
  );
  const selfAssignments = assignments.filter(
    (a) => a.type === 'self' && a.removed === 0,
  );
  const managerAssignments = assignments.filter(
    (a) => a.type === 'manager' && a.removed === 0,
  );

  function peerReviewersForSubject(subjectToken: string) {
    return activePeerAssignments.filter((a) => a.subject_token === subjectToken);
  }

  function memberByToken(token: string) {
    return membersList.find((m) => m.token === token);
  }

  // Check completion counts
  function completionFor(memberToken: string) {
    const selfA = selfAssignments.find((a) => a.reviewer_token === memberToken);
    const selfDone = selfA?.status === 'submitted' ? 1 : 0;

    const peersGiven = activePeerAssignments.filter((a) => a.reviewer_token === memberToken);
    const peersGivenDone = peersGiven.filter((a) => a.status === 'submitted').length;

    const peersReceived = activePeerAssignments.filter((a) => a.subject_token === memberToken);
    const peersReceivedDone = peersReceived.filter((a) => a.status === 'submitted').length;

    const managerA = managerAssignments.find((a) => a.subject_token === memberToken);
    const managerDone = managerA?.status === 'submitted' ? 1 : 0;

    const signoff = signoffs.find((s) => s.subject_token === memberToken);
    const signedOff = signoff?.manager_signed_at ? 1 : 0;

    return {
      selfDone,
      peersGivenDone,
      peersGivenTotal: peersGiven.length,
      peersReceivedDone,
      peersReceivedTotal: peersReceived.length,
      managerDone,
      signedOff,
    };
  }

  // Peers available to add for a subject (not already assigned, not the subject themselves)
  function availablePeersFor(subjectToken: string) {
    const assignedTokens = new Set(
      peerReviewersForSubject(subjectToken).map((a) => a.reviewer_token),
    );
    return membersList.filter(
      (m) => m.token !== subjectToken && !assignedTokens.has(m.token),
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Back link */}
        <Link href="/admin/reviews" className="text-sm text-gray-400 hover:text-gray-600 inline-block">
          ← Review Cycles
        </Link>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
            <span>{error}</span>
            <button className="underline ml-2" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* ── Header card ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              {isDraft ? (
                <input
                  type="text"
                  defaultValue={cycle.name}
                  onBlur={(e) => {
                    setCycle((c) => ({ ...c, name: e.target.value }));
                    handleFieldBlur('name', e.target.value);
                  }}
                  className="text-xl font-semibold text-gray-900 w-full border-0 border-b border-transparent hover:border-gray-200 focus:border-gray-300 focus:outline-none bg-transparent pb-0.5"
                />
              ) : (
                <h1 className="text-xl font-semibold text-gray-900">{cycle.name}</h1>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                {(['self_due', 'peer_due', 'manager_due'] as const).map((field) => (
                  <div key={field}>
                    <span className="text-gray-400 text-xs">
                      {field === 'self_due' ? 'Self due' : field === 'peer_due' ? 'Peer due' : 'Manager due'}:
                    </span>{' '}
                    {isDraft ? (
                      <input
                        type="date"
                        defaultValue={cycle[field] ?? ''}
                        onBlur={(e) => {
                          setCycle((c) => ({ ...c, [field]: e.target.value || null }));
                          handleFieldBlur(field, e.target.value);
                        }}
                        className="text-sm text-gray-700 border-0 border-b border-transparent hover:border-gray-200 focus:border-gray-300 focus:outline-none bg-transparent"
                      />
                    ) : (
                      <span className="text-gray-700">{cycle[field] ?? '—'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[cycle.status]}`}
            >
              {STATUS_LABELS[cycle.status]}
            </span>
          </div>
        </div>

        {/* ── Manager Assignments ── */}
        <Section title="Manager Assignments">
          {membersList.some((m) => !m.manager_token) && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              Some members have no manager assigned.
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Manager</th>
              </tr>
            </thead>
            <tbody>
              {membersList.map((member, idx) => (
                <tr key={member.token} className={idx < membersList.length - 1 ? 'border-b border-gray-100' : ''}>
                  <td className="py-2.5 font-medium text-gray-900">{member.name}</td>
                  <td className="py-2.5">
                    <select
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      value={member.manager_token || ''}
                      onChange={(e) => handleManagerChange(member.token, e.target.value)}
                    >
                      <option value="">— none —</option>
                      <option value={member.token}>Self</option>
                      {membersList
                        .filter((m) => m.token !== member.token)
                        .map((m) => (
                          <option key={m.token} value={m.token}>{m.name}</option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* ── Peer Matrix ── */}
        <Section title="Peer Review Matrix">
          <div className="space-y-4">
            {membersList.map((subject) => {
              const peers = peerReviewersForSubject(subject.token);
              const available = availablePeersFor(subject.token);
              const isAddingHere = addingPeerFor === subject.token;

              return (
                <div key={subject.token} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">{subject.name}</p>
                    {peers.length < 3 && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        {peers.length} reviewer{peers.length !== 1 ? 's' : ''} — add more
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {peers.map((a) => {
                      const reviewer = memberByToken(a.reviewer_token);
                      const submitted = a.status === 'submitted';
                      return (
                        <span
                          key={a.id}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                            submitted
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          {reviewer?.name ?? a.reviewer_token}
                          {cycle.status !== 'draft' && (
                            <span className="text-gray-400 ml-1">
                              {submitted ? '✓' : '—'}
                            </span>
                          )}
                          {isDraft && (
                            <button
                              onClick={() => handleRemovePeer(a.id)}
                              className="ml-1 text-gray-400 hover:text-red-500 transition-colors leading-none"
                              title="Remove"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      );
                    })}

                    {peers.length === 0 && (
                      <span className="text-xs text-gray-400">No peer reviewers assigned</span>
                    )}
                  </div>

                  {isDraft && (
                    <div>
                      {isAddingHere ? (
                        <div className="flex items-center gap-2">
                          <select
                            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                            value={peerSelectValue}
                            onChange={(e) => setPeerSelectValue(e.target.value)}
                            autoFocus
                          >
                            <option value="">Select reviewer…</option>
                            {available.map((m) => (
                              <option key={m.token} value={m.token}>{m.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAddPeer(subject.token, peerSelectValue)}
                            disabled={!peerSelectValue || peerAddLoading}
                            className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => { setAddingPeerFor(null); setPeerSelectValue(''); }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        available.length > 0 && (
                          <button
                            onClick={() => { setAddingPeerFor(subject.token); setPeerSelectValue(''); }}
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                          >
                            + Add reviewer
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Questions ── */}
        <Section title="Questions">
          <QuestionsTabPanel
            cycleId={cycleId}
            selfQuestions={selfQuestions}
            peerQuestions={peerQuestions}
            managerQuestions={managerQuestions}
            isLocked={!isDraft}
          />
        </Section>

        {/* ── Phase Controls ── */}
        <Section title="Phase Controls">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Current status:{' '}
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[cycle.status]}`}>
                  {STATUS_LABELS[cycle.status]}
                </span>
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {prev && (
                <button
                  onClick={() => handlePhase(prev)}
                  disabled={phaseLoading}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  ← Revert to {STATUS_LABELS[prev]}
                </button>
              )}
              {next && (
                <button
                  onClick={() => handlePhase(next)}
                  disabled={phaseLoading}
                  className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                >
                  {ADVANCE_LABELS[next] ?? `Advance to ${STATUS_LABELS[next]}`}
                </button>
              )}
              {cycle.status === 'closed' && (
                <p className="text-sm text-gray-400 py-2">Cycle is closed.</p>
              )}
            </div>
          </div>
        </Section>

        {/* ── Completion Status ── */}
        <Section title="Completion Status">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="pb-2 text-center text-xs font-medium text-gray-500">Self</th>
                <th className="pb-2 text-center text-xs font-medium text-gray-500">Peers given</th>
                <th className="pb-2 text-center text-xs font-medium text-gray-500">Peers received</th>
                <th className="pb-2 text-center text-xs font-medium text-gray-500">Manager</th>
                <th className="pb-2 text-center text-xs font-medium text-gray-500">Signed off</th>
                <th className="pb-2 text-center text-xs font-medium text-gray-500">Remind</th>
              </tr>
            </thead>
            <tbody>
              {membersList.map((member, idx) => {
                const c = completionFor(member.token);
                return (
                  <tr key={member.token} className={idx < membersList.length - 1 ? 'border-b border-gray-100' : ''}>
                    <td className="py-2.5 font-medium text-gray-900">{member.name}</td>
                    <td className="py-2.5 text-center">
                      {selfAssignments.find((a) => a.reviewer_token === member.token)
                        ? c.selfDone
                          ? <Check />
                          : <Dash />
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5 text-center text-gray-600">
                      {c.peersGivenTotal > 0
                        ? `${c.peersGivenDone}/${c.peersGivenTotal}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5 text-center text-gray-600">
                      {c.peersReceivedTotal > 0
                        ? `${c.peersReceivedDone}/${c.peersReceivedTotal}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5 text-center">
                      {managerAssignments.find((a) => a.subject_token === member.token)
                        ? c.managerDone
                          ? <Check />
                          : <Dash />
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5 text-center">
                      {c.signedOff ? <Check /> : <Dash />}
                    </td>
                    <td className="py-2.5 text-center">
                      <button
                        onClick={() => handleRemind(member.token)}
                        disabled={reminding[member.token]}
                        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                      >
                        {reminding[member.token] ? '…' : 'Remind'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Check() {
  return <span className="text-green-600 font-semibold">✓</span>;
}

function Dash() {
  return <span className="text-gray-300">—</span>;
}

function QuestionsTabPanel({
  cycleId,
  selfQuestions,
  peerQuestions,
  managerQuestions,
  isLocked,
}: {
  cycleId: number;
  selfQuestions: CycleQuestion[];
  peerQuestions: CycleQuestion[];
  managerQuestions: CycleQuestion[];
  isLocked: boolean;
}) {
  const [tab, setTab] = useState<'self' | 'peer' | 'manager'>('self');

  const tabs = [
    { key: 'self' as const, label: 'Self' },
    { key: 'peer' as const, label: 'Peer' },
  ];

  const questionsMap = { self: selfQuestions, peer: peerQuestions, manager: managerQuestions };

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-gray-100 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-brand-blue text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <QuestionsPanel
        key={tab}
        cycleId={cycleId}
        reviewType={tab}
        initialQuestions={questionsMap[tab]}
        isLocked={isLocked}
      />
    </div>
  );
}
