import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';

import { SignOutButton } from '@/components/SignOutButton';
import { auth } from '@/lib/auth';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Advanced AMD Dashboard',
  description: 'SIP-enhanced answering machine detection with Jambonz and Twilio'
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({ headers: headers() });

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <div className="min-h-screen">
          <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <div>
                <h1 className="text-lg font-semibold">Answering Machine Detection</h1>
                <p className="text-xs text-gray-500">Twilio + Jambonz SIP pipeline</p>
              </div>
              {session?.user ? (
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-600">{session.user.email}</div>
                  <SignOutButton />
                </div>
              ) : null}
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
