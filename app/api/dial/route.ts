import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db/prisma';
import { initiateTwilioNativeCall, initiateVoiceguardCall } from '@/lib/twilio/calls';
import { twilioPhoneNumber } from '@/lib/twilio/client';
import RestException from 'twilio/lib/base/RestException';

const dialRequestSchema = z.object({
  toNumber: z
    .string()
    .regex(/^\+\d{8,15}$/, 'Enter a valid E.164 number (e.g. +918765432109)'),
  amdStrategy: z.enum(['voiceguard', 'twilio-native']).default('voiceguard')
});

function normalizeServiceBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http')) return trimmed;
  if (trimmed.startsWith('ws')) {
    return trimmed.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  }
  return `https://${trimmed}`;
}

async function isVoiceguardAvailable(): Promise<boolean> {
  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
  if (!pythonServiceUrl) return false;

  try {
    const healthUrl = `${normalizeServiceBaseUrl(pythonServiceUrl)}/health`;
    const headers: Record<string, string> = {};
    if (process.env.PYTHON_SERVICE_API_KEY) {
      headers.Authorization = `Bearer ${process.env.PYTHON_SERVICE_API_KEY}`;
    }
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    return response.ok;
  } catch (error) {
    console.error('Voiceguard health check failed:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const payload = await request.json();
    const { toNumber, amdStrategy } = dialRequestSchema.parse(payload);

    let selectedStrategy = amdStrategy;

    if (amdStrategy === 'voiceguard') {
      const healthy = await isVoiceguardAvailable();
      if (!healthy) {
        selectedStrategy = 'twilio-native';
      }
    }

    if (!twilioPhoneNumber) {
      return NextResponse.json({ error: 'Twilio phone number not configured' }, { status: 500 });
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL;

    if (!appBaseUrl) {
      return NextResponse.json({ error: 'App base URL not configured' }, { status: 500 });
    }

    const twilioCall =
      selectedStrategy === 'voiceguard'
        ? await initiateVoiceguardCall({ toNumber, appBaseUrl })
        : await initiateTwilioNativeCall({ toNumber, appBaseUrl });

    const callRecord = await prisma.call.create({
      data: {
        callSid: twilioCall.sid,
        userId: user.id,
        toNumber,
        fromNumber: twilioPhoneNumber,
        amdStrategy: selectedStrategy,
        status: 'ringing',
        callStartedAt: selectedStrategy === 'voiceguard' ? new Date() : undefined
      }
    });

    return NextResponse.json({
      success: true,
      callId: callRecord.id,
      callSid: twilioCall.sid,
      strategy: selectedStrategy
    });
  } catch (error) {
    console.error('Dial error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message ?? 'Invalid input' }, { status: 400 });
    }

    const twilioError = error as RestException;
    if (typeof twilioError?.code === 'number') {
      if (twilioError.code === 21219) {
        return NextResponse.json(
          {
            error:
              'Twilio trial projects can only place calls to verified numbers. Verify the destination in the Twilio Console or upgrade the project, then retry.'
          },
          { status: 400 }
        );
      }
      if (twilioError.message) {
        return NextResponse.json({ error: twilioError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
}
