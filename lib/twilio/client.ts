import twilio, { Twilio } from 'twilio';

type TwilioClient = Twilio;

let twilioClient: TwilioClient | null = null;

export function getTwilioClient(): TwilioClient {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are not configured');
  }

  twilioClient = twilio(accountSid, authToken, {
    autoRetry: true,
    maxRetries: 3
  });

  return twilioClient;
}

export const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
