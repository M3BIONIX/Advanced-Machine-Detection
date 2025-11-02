import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST() {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const greetingUrl = process.env.TWILIO_HUMAN_GREETING_URL;

  if (greetingUrl) {
    response.play(greetingUrl);
  } else {
    response.say('Hello! Please hold while we connect you to an agent.');
  }

  return new NextResponse(response.toString(), {
    headers: { 'Content-Type': 'text/xml' }
  });
}

