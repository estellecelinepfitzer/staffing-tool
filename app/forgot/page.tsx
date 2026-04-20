'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function ForgotForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const router = useRouter();

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code: code.toUpperCase(), newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong');
      setSuccess(true);
      setTimeout(() => router.push(`/checkin?token=${token}`), 2000);
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
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Password updated</h1>
        <p className="text-sm text-gray-500">Redirecting to your check-in…</p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-7">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Reset your password</h1>
        <p className="text-sm text-gray-500">Enter the reset code your administrator sent you.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Reset code (e.g. A3F9B2C1)"
          autoFocus
          className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-mono tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent uppercase"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !code || !newPassword || !confirm}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving…' : 'Set new password'}
        </button>

        <p className="text-center text-xs text-gray-400 pt-1">
          Don&apos;t have a code?{' '}
          <a href={`/checkin?token=${token}`} className="underline hover:text-gray-600">
            Go back
          </a>
        </p>
      </form>
    </>
  );
}

export default function ForgotPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <Suspense>
          <ForgotForm />
        </Suspense>
      </div>
    </div>
  );
}
