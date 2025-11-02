'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isLoading}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? 'Signing out...' : 'Sign out'}
    </button>
  );
}
