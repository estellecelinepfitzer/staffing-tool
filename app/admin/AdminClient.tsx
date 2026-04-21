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
      </div>
    </div>
  );
}
