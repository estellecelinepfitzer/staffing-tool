'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TeamMemberRow, ReviewCycle } from '@/lib/db';

interface Category { id: number; label: string; sort_order: number; active: number; created_at: string; }

interface Props {
  members: TeamMemberRow[];
  cycles: ReviewCycle[];
  categories: Category[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 20);
}

export default function AdminClient({ members: initialMembers, cycles, categories: initialCategories }: Props) {
  const [members, setMembers] = useState<TeamMemberRow[]>(initialMembers);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState<Record<string, boolean>>({});
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

  // Settings dropdown + admin password change state
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminPw, setShowAdminPw] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
        setShowAdminPw(false);
      }
    }
    if (showSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);
  const [adminCurrentPw, setAdminCurrentPw] = useState('');
  const [adminNewPw, setAdminNewPw] = useState('');
  const [adminNewPwConfirm, setAdminNewPwConfirm] = useState('');
  const [adminPwSaving, setAdminPwSaving] = useState(false);
  const [adminPwError, setAdminPwError] = useState<string | null>(null);
  const [adminPwSuccess, setAdminPwSuccess] = useState(false);

  async function handleRoleToggle(token: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    if (newRole === 'member' && !confirm(`Remove admin access from this user? They will no longer be able to access the admin page.`)) return;
    setRoleSaving((s) => ({ ...s, [token]: true }));
    try {
      const res = await fetch(`/api/admin/team/${token}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      setMembers((prev) =>
        prev.map((m) => (m.token === token ? { ...m, role: newRole } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating role');
    } finally {
      setRoleSaving((s) => ({ ...s, [token]: false }));
    }
  }

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

  async function handleAddMember(sendInvite = false) {
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
      if (sendInvite) {
        await fetch(`/api/admin/team/${token}/invite`, { method: 'POST' });
      }
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

  async function handleAdminPwChange() {
    if (!adminCurrentPw || !adminNewPw || !adminNewPwConfirm) return;
    if (adminNewPw !== adminNewPwConfirm) { setAdminPwError('New passwords do not match'); return; }
    if (adminNewPw.length < 6) { setAdminPwError('Password must be at least 6 characters'); return; }
    setAdminPwSaving(true);
    setAdminPwError(null);
    try {
      const res = await fetch('/api/admin/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: adminCurrentPw, newPassword: adminNewPw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed');
      }
      setAdminPwSuccess(true);
      setAdminCurrentPw('');
      setAdminNewPw('');
      setAdminNewPwConfirm('');
      setTimeout(() => { setAdminPwSuccess(false); setShowAdminPw(false); }, 2000);
    } catch (err) {
      setAdminPwError(err instanceof Error ? err.message : 'Error changing password');
    } finally {
      setAdminPwSaving(false);
    }
  }

  async function handleAddCategory() {
    const label = newCategoryLabel.trim();
    if (!label) return;
    setAddingCategory(true);
    setCategoryError(null);
    try {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, sort_order: maxOrder }),
      });
      if (!res.ok) throw new Error('Failed to add category');
      const data = await res.json() as { id: number };
      setCategories((prev) => [...prev, { id: data.id, label, sort_order: maxOrder, active: 1, created_at: new Date().toISOString() }]);
      setNewCategoryLabel('');
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Error adding category');
    } finally {
      setAddingCategory(false);
    }
  }


  async function handleRenameCategory(id: number) {
    const label = editingCategoryLabel.trim();
    if (!label) { setEditingCategoryId(null); return; }
    try {
      await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      setCategories((prev) => prev.map((c) => c.id === id ? { ...c, label } : c));
    } catch {
      setCategoryError('Failed to rename category');
    } finally {
      setEditingCategoryId(null);
    }
  }

  async function handleDeleteCategory(id: number, label: string) {
    if (!confirm(`Delete category "${label}"?\n\nExisting submissions will retain the label at the time of submission, but new check-in forms will no longer show this category.`)) return;
    try {
      await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setCategoryError('Failed to delete category');
    }
  }

  async function handleMoveCategory(id: number, direction: 'up' | 'down') {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= categories.length) return;
    const updated = [...categories];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    // Reassign sort_order
    const reordered = updated.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(reordered);
    // Persist
    try {
      await Promise.all(reordered.map((c) =>
        fetch(`/api/admin/categories/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: c.sort_order }),
        }),
      ));
    } catch {
      setCategoryError('Failed to reorder categories');
    }
  }

  const activeMembers = members.filter((m) => m.active);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mtip-logo.png" alt="MTIP" className="h-7 w-auto" />
            <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
          </div>
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
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => { setShowSettings((p) => !p); setShowAdminPw(false); }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showSettings ? 'border-gray-800 bg-brand-blue text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                title="Settings"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>

              {showSettings && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl border border-gray-200 shadow-lg py-1">
                  {!showAdminPw ? (
                    <button
                      onClick={() => setShowAdminPw(true)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Change admin password
                    </button>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-700 mb-3">Change admin password</p>
                      <div className="space-y-2">
                        <input
                          type="password"
                          placeholder="Current password"
                          value={adminCurrentPw}
                          onChange={(e) => setAdminCurrentPw(e.target.value)}
                          className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        />
                        <input
                          type="password"
                          placeholder="New password"
                          value={adminNewPw}
                          onChange={(e) => setAdminNewPw(e.target.value)}
                          className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        />
                        <input
                          type="password"
                          placeholder="Confirm new password"
                          value={adminNewPwConfirm}
                          onChange={(e) => setAdminNewPwConfirm(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAdminPwChange(); }}
                          className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        />
                        {adminPwError && <p className="text-xs text-red-600">{adminPwError}</p>}
                        {adminPwSuccess && <p className="text-xs text-green-600">Password updated.</p>}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleAdminPwChange}
                            disabled={adminPwSaving || !adminCurrentPw || !adminNewPw || !adminNewPwConfirm}
                            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                          >
                            {adminPwSaving ? 'Saving…' : 'Update password'}
                          </button>
                          <button
                            onClick={() => { setShowAdminPw(false); setAdminPwError(null); setAdminCurrentPw(''); setAdminNewPw(''); setAdminNewPwConfirm(''); }}
                            className="text-sm text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowCategoryPanel((p) => !p)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Manage staffing categories
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showCategoryPanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <a
            href="/goals"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Manage goals →
          </a>
        </div>

        <div className="mb-4">

          {showCategoryPanel && (
            <div className="mt-2 bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Check-in categories</p>
              <p className="text-xs text-gray-400 mb-4">These appear on the weekly check-in form and dashboard. Deleted categories are hidden from new forms but historical submissions retain their labels.</p>

              {categoryError && (
                <p className="text-xs text-red-600 mb-3">{categoryError} <button className="underline" onClick={() => setCategoryError(null)}>Dismiss</button></p>
              )}

              <div className="space-y-1 mb-4">
                {categories.map((cat, idx) => (
                  <div key={cat.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    {/* Reorder */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveCategory(cat.id, 'up')}
                        disabled={idx === 0}
                        className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button
                        onClick={() => handleMoveCategory(cat.id, 'down')}
                        disabled={idx === categories.length - 1}
                        className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>

                    {/* Label / edit */}
                    {editingCategoryId === cat.id ? (
                      <input
                        type="text"
                        value={editingCategoryLabel}
                        onChange={(e) => setEditingCategoryLabel(e.target.value)}
                        onBlur={() => handleRenameCategory(cat.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameCategory(cat.id);
                          if (e.key === 'Escape') setEditingCategoryId(null);
                        }}
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm text-gray-700 cursor-pointer hover:text-gray-900"
                        onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryLabel(cat.label); }}
                        title="Click to rename"
                      >
                        {cat.label}
                      </span>
                    )}

                    <button
                      onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryLabel(cat.label); }}
                      className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-1"
                      title="Rename"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.label)}
                      className="text-xs text-red-400 hover:text-red-600 underline underline-offset-1"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                ))}

                {categories.length === 0 && (
                  <p className="text-xs text-gray-400">No categories yet.</p>
                )}
              </div>

              {/* Add new */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                  placeholder="New category name…"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
                <button
                  onClick={handleAddCategory}
                  disabled={addingCategory || !newCategoryLabel.trim()}
                  className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
                >
                  {addingCategory ? '…' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Team members table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Manager</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Check-in</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Password</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Active</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isActive = !!member.active;
                return (
                  <tr
                    key={member.token}
                    className={[
                      'border-b border-gray-100',
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

                    {/* Role */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRoleToggle(member.token, member.role)}
                        disabled={roleSaving[member.token] || !isActive}
                        className={[
                          'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                          member.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                            : 'border border-gray-200 text-gray-400 hover:bg-gray-50',
                        ].join(' ')}
                        title={member.role === 'admin' ? 'Click to remove admin' : 'Click to make admin'}
                      >
                        {member.role === 'admin' ? 'Admin' : 'Member'}
                      </button>
                    </td>

                    {/* Manager dropdown */}
                    <td className="px-4 py-3">
                      <select
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-teal disabled:opacity-50"
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
                              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-brand-teal"
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
                              className="rounded-lg bg-brand-blue px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
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
                          <button
                            onClick={() => handleSetActive(member.token, member.name, true)}
                            disabled={saving[`active_${member.token}`]}
                            className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(member.token, member.name)}
                          disabled={saving[`delete_${member.token}`]}
                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 transition-colors"
                        >
                          Delete
                        </button>
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
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  placeholder="Full name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Email</label>
                <input
                  type="email"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  placeholder="email@mtip.ch"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Password</label>
                <input
                  type="text"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  placeholder="Initial password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button
                onClick={() => handleAddMember(true)}
                disabled={adding || !newName.trim() || !newEmail.trim() || !newPassword.trim()}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-[#006BB0] disabled:opacity-40 transition-colors"
              >
                {adding ? 'Adding…' : 'Add & send invite'}
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

