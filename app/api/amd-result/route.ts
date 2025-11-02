import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { getTwilioClient } from '@/lib/twilio/client';

interface DetectionPayload {
  callSid: string;
  label: 'human' | 'machine' | string;
  confidence?: number;
  timestamp?: number;
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.PYTHON_SERVICE_API_KEY;
    if (expectedToken) {
      const authHeader = request.headers.get('authorization') ?? '';
      const [scheme, token] = authHeader.split(' ');
      if (scheme !== 'Bearer' || token !== expectedToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const payload = (await request.json()) as DetectionPayload;
    const { callSid, label } = payload;
    const confidence =
      typeof payload.confidence === 'number'
        ? payload.confidence
        : Number(payload.confidence) || 0;

    if (!callSid || !label) {
      return NextResponse.json({ error: 'Invalid detection payload' }, { status: 400 });
    }

    const call = await prisma.call.findUnique({ where: { callSid } });
    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    const detectionStatus = label === 'machine' ? 'machine_detected' : 'human_detected';

    await prisma.call.update({
      where: { id: call.id },
      data: {
        amdResult: label,
        amdConfidence: confidence,
        status: detectionStatus,
        callStartedAt: call.callStartedAt ?? new Date(),
        detectedAt: new Date()
      }
    });

    const twilioClient = getTwilioClient();

    if (label === 'machine') {
      await twilioClient.calls(callSid).update({ status: 'completed' });
    } else if (label === 'human') {
      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL;
      if (appBaseUrl) {
        await twilioClient.calls(callSid).update({
          url: `${appBaseUrl}/api/twiml/connect-human`,
          method: 'POST'
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AMD result handling failed:', error);
    return NextResponse.json({ error: 'Failed to process detection result' }, { status: 500 });
  }
}

