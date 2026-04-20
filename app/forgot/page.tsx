'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

// ─── Step 1: enter email to receive reset code ─────────────────────────────

function RequestCodeForm({ onSent }: { onSent: (token: string) => void }) {
  const searchParams = useSearchParams();
  const tokenHint = searchParams.get('token') ?? '';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetch('/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Always advance — don't leak whether the email exists
      onSent(tokenHint);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="text-center mb-7">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Forgot your password?</h1>
        <p className="text-sm text-gray-500">
          Enter your work email and we'll send you a reset code.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@mtip.ch"
          autoFocus
          className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sending…' : 'Send reset code'}
        </button>
      </form>
    </>
  );
}

// ─── Step 2: enter code + new password ────────────────────────────────────

function ResetForm({ tokenHint }: { tokenHint: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? tokenHint;

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
        body: JSON.stringify({ token, code: code.trim().toUpperCase(), newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong');
      setSuccess(true);
      setTimeout(() => router.push(token ? `/checkin?token=${token}` : '/'), 2000);
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
        <p className="text-sm text-gray-500">Redirecting…</p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-7">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Enter your reset code</h1>
        <p className="text-sm text-gray-500">Check your email for the 8-character code.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A3F9B2C1"
          autoFocus
          maxLength={8}
          className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-mono tracking-widest uppercase placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
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
      </form>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ForgotPageInner() {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [tokenHint, setTokenHint] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        {step === 'request' ? (
          <RequestCodeForm onSent={(t) => { setTokenHint(t); setStep('reset'); }} />
        ) : (
          <ResetForm tokenHint={tokenHint} />
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          <a href="/" className="underline hover:text-gray-600">Back to login</a>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPage() {
  return (
    <Suspense>
      <ForgotPageInner />
    </Suspense>
  );
}
