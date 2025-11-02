import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const call = await prisma.call.findFirst({
      where: {
        id: params.id,
        userId: user.id
      },
      include: {
        amdEvents: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    return NextResponse.json(call);
  } catch (error) {
    console.error('Call polling error:', error);
    return NextResponse.json({ error: 'Failed to retrieve call' }, { status: 500 });
  }
}
