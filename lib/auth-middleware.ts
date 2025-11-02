import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string | null;
};

export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name
  };
}
