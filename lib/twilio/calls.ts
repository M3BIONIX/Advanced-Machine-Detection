import type { CallInstance } from 'twilio/lib/rest/api/v2010/account/call';

import { getTwilioClient, twilioPhoneNumber } from '@/lib/twilio/client';

interface MediaStreamCallOptions {
  toNumber: string;
  appBaseUrl: string;
}

export async function initiateVoiceguardCall({
  toNumber,
  appBaseUrl
}: MediaStreamCallOptions): Promise<CallInstance> {
  const client = getTwilioClient();
  const fromNumber = twilioPhoneNumber;

  if (!fromNumber) {
    throw new Error('Twilio phone number is not configured');
  }

  const twimlUrl = `${appBaseUrl}/api/twiml/connect-stream`;
  const statusCallback = `${appBaseUrl}/api/webhooks/call-status`;

  return client.calls.create({
    to: toNumber,
    from: fromNumber,
    url: twimlUrl,
    method: 'POST',
    statusCallback,
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
  });
}

interface NativeAmdCallOptions {
  toNumber: string;
  appBaseUrl: string;
  machineDetectionTimeout?: number;
}

export async function initiateTwilioNativeCall({
  toNumber,
  appBaseUrl,
  machineDetectionTimeout = 20
}: NativeAmdCallOptions): Promise<CallInstance> {
  const client = getTwilioClient();
  const fromNumber = twilioPhoneNumber;

  if (!fromNumber) {
    throw new Error('Twilio phone number is not configured');
  }

  const statusCallback = `${appBaseUrl}/api/webhooks/call-status`;

  return client.calls.create({
    to: toNumber,
    from: fromNumber,
    url: `${appBaseUrl}/api/twiml/connect-human`,
    method: 'POST',
    machineDetection: 'Enable',
    machineDetectionTimeout: machineDetectionTimeout,
    statusCallback,
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
  });
}
