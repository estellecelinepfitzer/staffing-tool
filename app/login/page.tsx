'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.ok) {
        const data = await res.json() as { ok: boolean; token: string };
        // Always redirect to the user's own /my-reviews unless `from` is a different page
        const dest = (from && from.startsWith('/') && !from.startsWith('/my-reviews'))
          ? from
          : `/my-reviews?token=${data.token}`;
        router.push(dest);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? 'Incorrect email or password');
        setLoading(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/mtip-logo.png"
            alt="MTIP"
            width={80}
            height={32}
            className="mx-auto mb-6 object-contain"
            priority
          />
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h1>
          <p className="text-sm text-gray-500">MTIP Team Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
            placeholder="Email address"
            required
            className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Password"
            required
            className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-brand-blue text-white rounded-xl py-3 text-sm font-medium hover:bg-[#006BB0] active:bg-[#005A96] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
