'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReviewCycle, CycleStatus } from '@/lib/db';

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

interface Props {
  cycles: ReviewCycle[];
}

export default function ReviewsClient({ cycles: initialCycles }: Props) {
  const [cycles, setCycles] = useState<ReviewCycle[]>(initialCycles);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    self_due: '',
    peer_due: '',
    manager_due: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const router = useRouter();

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete cycle');
      setCycles((prev) => prev.filter((c) => c.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting cycle');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          self_due: formData.self_due || undefined,
          peer_due: formData.peer_due || undefined,
          manager_due: formData.manager_due || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create cycle');
      const data = await res.json() as { id: number; ok: boolean };
      router.push(`/admin/reviews/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating cycle');
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 mb-5 inline-block">
          ← Admin
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Review Cycles</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {showForm ? 'Cancel' : '+ New cycle'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* New cycle form */}
        {showForm && (
          <div className="mb-6 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">New Review Cycle</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cycle name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. H1 2026 Review"
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Self review due</label>
                  <input
                    type="date"
                    value={formData.self_due}
                    onChange={(e) => setFormData((f) => ({ ...f, self_due: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Peer review due</label>
                  <input
                    type="date"
                    value={formData.peer_due}
                    onChange={(e) => setFormData((f) => ({ ...f, peer_due: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Manager review due</label>
                  <input
                    type="date"
                    value={formData.manager_due}
                    onChange={(e) => setFormData((f) => ({ ...f, manager_due: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating || !formData.name.trim()}
                  className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create cycle'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cycles list */}
        {cycles.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">No review cycles yet.</div>
        ) : (
          <div className="space-y-2">
            {cycles.map((cycle) => (
              <div key={cycle.id}>
                {confirmDeleteId === cycle.id ? (
                  <div className="flex items-center justify-between bg-red-50 rounded-xl border border-red-200 px-5 py-4">
                    <p className="text-sm text-red-700 font-medium">
                      Permanently delete &ldquo;{cycle.name}&rdquo;? This cannot be undone.
                    </p>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => handleDelete(cycle.id)}
                        disabled={deletingId === cycle.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
                      >
                        {deletingId === cycle.id ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <Link
                      href={`/admin/reviews/${cycle.id}`}
                      className="flex-1 flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{cycle.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Created {new Date(cycle.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[cycle.status]}`}
                        >
                          {STATUS_LABELS[cycle.status]}
                        </span>
                        <span className="text-gray-300 group-hover:text-gray-400">→</span>
                      </div>
                    </Link>
                    <button
                      onClick={() => setConfirmDeleteId(cycle.id)}
                      className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete cycle"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
