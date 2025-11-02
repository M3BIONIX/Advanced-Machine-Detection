import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@prisma/client';

import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: {
    callSid: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const call = await prisma.call.findFirst({
    where: {
      callSid: params.callSid,
      userId: user.id
    } as Prisma.CallWhereInput,
    // Casts required until Prisma migration applied to the shared database
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    select: {
      callSid: true,
      status: true,
      amdResult: true,
      amdConfidence: true,
      amdStrategy: true,
      detectedAt: true,
      updatedAt: true
    } as any
  });

  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  const output = call as any;

  return NextResponse.json({
    callSid: output.callSid,
    status: output.status,
    amdResult: output.amdResult
      ? {
          label: output.amdResult,
          confidence: output.amdConfidence ?? 0
        }
      : null,
    amdStrategy: output.amdStrategy,
    detectedAt: output.detectedAt,
    updatedAt: output.updatedAt
  });
}

