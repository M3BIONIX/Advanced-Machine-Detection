'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

type AuthMode = 'signIn' | 'signUp';

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const parse = authSchema.safeParse({ email, password });
    if (!parse.success) {
      setError(parse.error.issues[0]?.message ?? 'Invalid credentials');
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = mode === 'signIn' ? '/api/auth/sign-in/email' : '/api/auth/sign-up/email';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: parse.data.email,
          password: parse.data.password,
          name: parse.data.email.split('@')[0]
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(data.message || 'Request failed');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to authenticate';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Answering Machine Detection</h2>
        <p className="text-sm text-gray-500">
          Sign in to place calls through the Jambonz + Twilio SIP pipeline.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setMode('signIn')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === 'signIn' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signUp')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === 'signUp' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'
            }`}
          >
            Create Account
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              required
            />
            <p className="text-xs text-gray-400">Minimum 8 characters.</p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting ? 'Processing...' : mode === 'signIn' ? 'Sign In' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
