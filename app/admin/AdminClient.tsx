'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TeamMemberRow } from '@/lib/db';

interface Props {
  members: TeamMemberRow[];
}

export default function AdminClient({ members: initialMembers }: Props) {
  const [members, setMembers] = useState<TeamMemberRow[]>(initialMembers);
  const [passwordReset, setPasswordReset] = useState<Record<string, string>>({});
  const [passwordInput, setPasswordInput] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleManagerChange(token: string, managerToken: string) {
    setSaving((s) => ({ ...s, [`manager_${token}`]: true }));
    try {
      const res = await fetch(`/api/admin/team/${token}/manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: managerToken }),
      });
      if (!res.ok) throw new Error('Failed to update manager');
      setMembers((prev) =>
        prev.map((m) => (m.token === token ? { ...m, manager_token: managerToken } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating manager');
    } finally {
      setSaving((s) => ({ ...s, [`manager_${token}`]: false }));
    }
  }

  function openPasswordReset(token: string) {
    setPasswordReset((p) => ({ ...p, [token]: 'open' }));
    setPasswordInput((p) => ({ ...p, [token]: '' }));
  }

  function cancelPasswordReset(token: string) {
    setPasswordReset((p) => ({ ...p, [token]: '' }));
  }

  async function handlePasswordSave(token: string) {
    const pw = passwordInput[token] ?? '';
    if (!pw) return;
    setSaving((s) => ({ ...s, [`pw_${token}`]: true }));
    try {
      const res = await fetch(`/api/admin/team/${token}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) throw new Error('Failed to reset password');
      setPasswordReset((p) => ({ ...p, [token]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error resetting password');
    } finally {
      setSaving((s) => ({ ...s, [`pw_${token}`]: false }));
    }
  }

  async function handleDeactivate(token: string, name: string) {
    if (!confirm(`Deactivate ${name}? They will no longer appear in check-ins or reviews.`)) return;
    setSaving((s) => ({ ...s, [`active_${token}`]: true }));
    try {
      const res = await fetch(`/api/admin/team/${token}/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      if (!res.ok) throw new Error('Failed to deactivate member');
      setMembers((prev) => prev.filter((m) => m.token !== token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deactivating member');
    } finally {
      setSaving((s) => ({ ...s, [`active_${token}`]: false }));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
          <Link
            href="/admin/reviews"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Review Cycles
            <span className="ml-1">→</span>
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button className="ml-2 underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* Team members table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Manager</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Password</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Active</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, idx) => (
                <tr
                  key={member.token}
                  className={idx < members.length - 1 ? 'border-b border-gray-100' : ''}
                >
                  {/* Name */}
                  <td className="px-4 py-3 font-medium text-gray-900">{member.name}</td>

                  {/* Email */}
                  <td className="px-4 py-3 text-gray-500">{member.email}</td>

                  {/* Manager dropdown */}
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-800"
                      value={member.manager_token || ''}
                      disabled={saving[`manager_${member.token}`]}
                      onChange={(e) => handleManagerChange(member.token, e.target.value)}
                    >
                      <option value="">— none —</option>
                      <option value={member.token}>Self</option>
                      {members
                        .filter((m) => m.token !== member.token)
                        .map((m) => (
                          <option key={m.token} value={m.token}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </td>

                  {/* Password reset */}
                  <td className="px-4 py-3">
                    {passwordReset[member.token] === 'open' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-gray-800"
                          placeholder="New password"
                          value={passwordInput[member.token] ?? ''}
                          onChange={(e) =>
                            setPasswordInput((p) => ({ ...p, [member.token]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePasswordSave(member.token);
                            if (e.key === 'Escape') cancelPasswordReset(member.token);
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handlePasswordSave(member.token)}
                          disabled={saving[`pw_${member.token}`] || !passwordInput[member.token]}
                          className="rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => cancelPasswordReset(member.token)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openPasswordReset(member.token)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </td>

                  {/* Deactivate */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeactivate(member.token, member.name)}
                      disabled={saving[`active_${member.token}`]}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Member {
  token: string;
  name: string;
  email: string;
  active: number;
  created_at: string;
}

export default function AdminClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const router = useRouter();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const fetchMembers = useCallback(async (pw: string) => {
    const res = await fetch('/api/admin/users', {
      headers: { 'x-admin-password': pw },
    });
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
      setAuthError(false);
    } else if (res.status === 401) {
      setAuthError(true);
      sessionStorage.removeItem('admin_pw');
      setAdminPassword('');
    } else {
      showToast(`Error loading members (${res.status})`);
    }
    setLoading(false);
  }, []);

  // Ask for password on mount (stored in state, not cookies, for the API header)
  useEffect(() => {
    const stored = sessionStorage.getItem('admin_pw') ?? '';
    if (stored) {
      setAdminPassword(stored);
      fetchMembers(stored);
    } else {
      setLoading(false);
    }
  }, [fetchMembers]);

  async function initPassword() {
    sessionStorage.setItem('admin_pw', adminPassword);
    await fetchMembers(adminPassword);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword,
      },
      body: JSON.stringify({ name: newName, email: newEmail }),
    });

    const data = await res.json().catch(() => ({})) as { error?: string; token?: string };
    if (!res.ok) {
      setAddError(data.error ?? 'Something went wrong');
    } else {
      setNewName('');
      setNewEmail('');
      setShowAddForm(false);
      showToast(`Added ${newName} — welcome email sent`);
      await fetchMembers(adminPassword);
    }
    setAdding(false);
  }

  async function toggleActive(member: Member) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword,
      },
      body: JSON.stringify({ token: member.token, active: member.active === 0 }),
    });
    showToast(`${member.name} ${member.active === 1 ? 'deactivated' : 'reactivated'}`);
    await fetchMembers(adminPassword);
  }

  async function sendReset(member: Member) {
    setResetSending(true);
    setResetTarget(member.token);

    const res = await fetch('/api/admin/reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword, token: member.token }),
    });

    if (res.ok) {
      showToast(`Reset email sent to ${member.email}`);
    } else {
      showToast('Failed to send reset email');
    }
    setResetSending(false);
    setResetTarget(null);
  }

  async function signOut() {
    await fetch('/api/auth/admin', { method: 'DELETE' });
    sessionStorage.removeItem('admin_pw');
    router.refresh();
  }

  // If no password yet, prompt
  if (!adminPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm space-y-3">
          <p className="text-sm text-gray-700 text-center">Enter admin password to load users</p>
          {authError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-center">
              Incorrect password
            </p>
          )}
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && initPassword()}
            autoFocus
            placeholder="Admin password"
            className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <button
            onClick={initPassword}
            disabled={!adminPassword}
            className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
          >
            Load
          </button>
        </div>
      </div>
    );
  }

  const active   = members.filter((m) => m.active === 1);
  const inactive = members.filter((m) => m.active === 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Admin</h1>
            <p className="text-xs text-gray-400">Manage team members</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-xs text-gray-400 hover:text-gray-700 underline">
              Dashboard
            </a>
            <button
              onClick={signOut}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Active members */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Team members <span className="text-gray-400 font-normal">({active.length})</span>
            </h2>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              + Add member
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <form
              onSubmit={handleAdd}
              className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3"
            >
              <h3 className="text-sm font-medium text-gray-700">New team member</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name"
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@mtip.ch"
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
              </div>
              {addError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="bg-gray-900 text-white text-xs px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40"
                >
                  {adding ? 'Adding…' : 'Add & send welcome email'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-sm text-gray-400 py-4">Loading…</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Email</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">Check-in link</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {active.map((m) => (
                    <tr key={m.token} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                      <td className="px-4 py-3 text-gray-500">{m.email}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <code className="text-xs text-gray-400">?token={m.token}</code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => sendReset(m)}
                            disabled={resetSending && resetTarget === m.token}
                            className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2"
                          >
                            {resetSending && resetTarget === m.token ? 'Sending…' : 'Send reset'}
                          </button>
                          <button
                            onClick={() => toggleActive(m)}
                            className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Inactive members */}
        {inactive.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3">
              Inactive <span className="font-normal">({inactive.length})</span>
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden opacity-60">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {inactive.map((m) => (
                    <tr key={m.token} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 line-through">{m.name}</td>
                      <td className="px-4 py-3 text-gray-400">{m.email}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(m)}
                          className="text-xs text-green-600 hover:text-green-800 underline underline-offset-2"
                        >
                          Reactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
