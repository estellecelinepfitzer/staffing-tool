'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TeamMemberRow } from '@/lib/db';

interface Props {
  members: TeamMemberRow[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 20);
}

export default function AdminClient({ members: initialMembers }: Props) {
  const [members, setMembers] = useState<TeamMemberRow[]>(initialMembers);
  const [passwordReset, setPasswordReset] = useState<Record<string, string>>({});
  const [passwordInput, setPasswordInput] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Add member form state
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [adding, setAdding] = useState(false);

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

  async function handleCheckinToggle(token: string, checkin: boolean) {
    setSaving((s) => ({ ...s, [`checkin_${token}`]: true }));
    try {
      const res = await fetch(`/api/admin/team/${token}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkin }),
      });
      if (!res.ok) throw new Error('Failed to update check-in');
      setMembers((prev) =>
        prev.map((m) => (m.token === token ? { ...m, checkin: checkin ? 1 : 0 } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating check-in');
    } finally {
      setSaving((s) => ({ ...s, [`checkin_${token}`]: false }));
    }
  }

  async function handleDelete(token: string, name: string) {
    if (!confirm(`Permanently delete ${name}? This removes all their check-ins and review data and cannot be undone.`)) return;
    setSaving((s) => ({ ...s, [`delete_${token}`]: true }));
    try {
      const res = await fetch(`/api/admin/team/${token}/delete`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete member');
      setMembers((prev) => prev.filter((m) => m.token !== token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting member');
    } finally {
      setSaving((s) => ({ ...s, [`delete_${token}`]: false }));
    }
  }

  async function handleSetActive(token: string, name: string, active: boolean) {
    const label = active ? 'Activate' : 'Deactivate';
    if (!active && !confirm(`Deactivate ${name}? They will no longer appear in check-ins or reviews.`)) return;
    setSaving((s) => ({ ...s, [`active_${token}`]: true }));
    try {
      const res = await fetch(`/api/admin/team/${token}/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error(`Failed to ${label.toLowerCase()} member`);
      setMembers((prev) =>
        prev.map((m) => (m.token === token ? { ...m, active: active ? 1 : 0 } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error: ${label}`);
    } finally {
      setSaving((s) => ({ ...s, [`active_${token}`]: false }));
    }
  }

  async function handleAddMember() {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return;
    setAdding(true);
    try {
      const token = slugify(newName) + '-' + Date.now().toString(36);
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: newName.trim(), email: newEmail.trim(), password: newPassword.trim() }),
      });
      if (!res.ok) throw new Error('Failed to add member');
      const data = await res.json() as { member: TeamMemberRow };
      setMembers((prev) => [...prev, data.member].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding member');
    } finally {
      setAdding(false);
    }
  }

  const activeMembers = members.filter((m) => m.active);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← Dashboard
            </Link>
            <Link
              href="/admin/reviews"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Review Cycles →
            </Link>
          </div>
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Manager</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Check-in</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Password</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Active</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, idx) => {
                const isActive = !!member.active;
                return (
                  <tr
                    key={member.token}
                    className={[
                      idx < members.length - 1 ? 'border-b border-gray-100' : '',
                      !isActive ? 'opacity-50' : '',
                    ].join(' ')}
                  >
                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {member.name}
                      {!isActive && (
                        <span className="ml-2 text-xs font-normal text-gray-400">(inactive)</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-gray-500">{member.email}</td>

                    {/* Manager dropdown */}
                    <td className="px-4 py-3">
                      <select
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:opacity-50"
                        value={member.manager_token || ''}
                        disabled={saving[`manager_${member.token}`] || !isActive}
                        onChange={(e) => handleManagerChange(member.token, e.target.value)}
                      >
                        <option value="">— none —</option>
                        <option value={member.token}>Self</option>
                        {activeMembers
                          .filter((m) => m.token !== member.token)
                          .map((m) => (
                            <option key={m.token} value={m.token}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </td>

                    {/* Check-in toggle */}
                    <td className="px-4 py-3">
                      {isActive && (
                        <button
                          onClick={() => handleCheckinToggle(member.token, !member.checkin)}
                          disabled={saving[`checkin_${member.token}`]}
                          className={[
                            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                            member.checkin
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                              : 'border border-gray-200 text-gray-400 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          {member.checkin ? '✓ Yes' : 'No'}
                        </button>
                      )}
                    </td>

                    {/* Password reset */}
                    <td className="px-4 py-3">
                      {isActive && (
                        passwordReset[member.token] === 'open' ? (
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
                        )
                      )}
                    </td>

                    {/* Activate / Deactivate / Delete */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <button
                            onClick={() => handleSetActive(member.token, member.name, false)}
                            disabled={saving[`active_${member.token}`]}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSetActive(member.token, member.name, true)}
                              disabled={saving[`active_${member.token}`]}
                              className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors"
                            >
                              Activate
                            </button>
                            <button
                              onClick={() => handleDelete(member.token, member.name)}
                              disabled={saving[`delete_${member.token}`]}
                              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add member */}
        {showAdd ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Add team member</h2>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Name</label>
                <input
                  type="text"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-gray-800"
                  placeholder="Full name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Email</label>
                <input
                  type="email"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gray-800"
                  placeholder="email@mtip.ch"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Password</label>
                <input
                  type="text"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-gray-800"
                  placeholder="Initial password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button
                onClick={handleAddMember}
                disabled={adding || !newName.trim() || !newEmail.trim() || !newPassword.trim()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors w-full"
          >
            + Add team member
          </button>
        )}
      </div>
    </div>
  );
}
