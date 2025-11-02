import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from 'twilio';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

function formDataToObject(formData: FormData): Record<string, string> {
  const entries: Record<string, string> = {};
  const iterator = formData.entries();
  let step = iterator.next();

  while (!step.done) {
    const [key, value] = step.value;
    if (typeof value === 'string') {
      entries[key] = value;
    }
    step = iterator.next();
  }

  return entries;
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-twilio-signature');
    if (!signature || !twilioAuthToken) {
      console.error('Missing Twilio signature or auth token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const params = formDataToObject(formData);

    const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '') ?? 'http';
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    const resolvedUrl = host ? `${protocol}://${host}${request.nextUrl.pathname}${request.nextUrl.search}` : request.nextUrl.href;

    const isValid = validateRequest(
      twilioAuthToken,
      signature,
      resolvedUrl,
      params
    );

    if (!isValid) {
      console.error('Twilio signature validation failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callSid = params['CallSid'];
    const callStatus = params['CallStatus'];
    const callDuration = params['CallDuration'];
    const answeredBy = params['AnsweredBy'];

    if (!callSid) {
      return NextResponse.json({ success: true });
    }

    const call = await prisma.call.findUnique({ where: { callSid } });
    if (!call) {
      return NextResponse.json({ success: true });
    }

    const updates: Prisma.CallUpdateInput = {
      status: callStatus || call.status,
      duration: callDuration ? parseInt(callDuration, 10) : call.duration,
      callEndedAt: callStatus === 'completed' ? new Date() : call.callEndedAt
    };

    if (!call.callStartedAt && callStatus === 'in-progress') {
      updates.callStartedAt = new Date();
    }

    let detectedAt: Date | undefined;

    if (answeredBy) {
      const normalized = answeredBy.toLowerCase();
      if (normalized === 'machine') {
        updates.amdResult = 'machine';
        updates.status = 'machine_detected';
        detectedAt = new Date();
      } else if (normalized === 'human') {
        updates.amdResult = 'human';
        updates.status = 'human_detected';
        detectedAt = new Date();
      } else {
        updates.amdResult = normalized;
      }
    }

    const data: Prisma.CallUpdateInput = detectedAt
      ? {
          ...updates,
          detectedAt
        }
      : updates;

    await prisma.call.update({
      where: { id: call.id },
      data
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Twilio status callback error:', error);
    return NextResponse.json({ success: true });
  }
}
