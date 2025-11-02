import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { DialInterface } from '@/components/DialInterface';
import { CallHistory } from '@/components/CallHistory';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: headers() });

  if (!session?.user) {
    redirect('/');
  }

  const calls = await prisma.call.findMany({
    where: { userId: session.user.id },
    include: { amdEvents: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  return (
    <div className="space-y-8">
      <DialInterface />
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-3">Recent Calls</h3>
        <CallHistory calls={calls} />
      </div>
    </div>
  );
}
