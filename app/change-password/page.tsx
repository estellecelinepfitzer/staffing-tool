'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function ChangePasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) { setError('New passwords do not match'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword === currentPassword) { setError('New password must be different from current'); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong');
      setSuccess(true);
      setTimeout(() => router.push(`/my-reviews?token=${token}`), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-10 h-10 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Password changed</h1>
        <p className="text-sm text-gray-500">Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-2">
        <a
          href={`/my-reviews?token=${token}`}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </a>
      </div>

      <div className="text-center mb-7 mt-4">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Change password</h1>
        <p className="text-sm text-gray-500">Your new password must be at least 6 characters.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          autoFocus
          className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !currentPassword || !newPassword || !confirm}
          className="w-full bg-brand-blue text-white rounded-xl py-3 text-sm font-medium hover:bg-[#006BB0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </>
  );
}

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <Suspense>
          <ChangePasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
