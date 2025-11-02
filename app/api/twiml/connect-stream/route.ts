import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

function buildWebSocketUrl(base: string, callSid: string, apiKey?: string) {
  const trimmed = base.replace(/\/$/, '');
  const urlBase = trimmed.startsWith('ws')
    ? trimmed
    : `wss://${trimmed.replace(/^https?:\/\//, '')}`;

  const url = `${urlBase}/ws/audio-stream/${callSid}`;
  if (!apiKey) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(apiKey)}`;
}

async function getCallSid(request: NextRequest) {
  const urlCallSid = request.nextUrl.searchParams.get('CallSid');
  if (urlCallSid) return urlCallSid;

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    const formCallSid = formData.get('CallSid');
    if (typeof formCallSid === 'string') {
      return formCallSid;
    }
  }

  return `unknown-${Date.now()}`;
}

export async function POST(request: NextRequest) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
  if (!pythonServiceUrl) {
    return NextResponse.json({ error: 'VoiceGUARD service URL missing' }, { status: 500 });
  }

  const apiKey = process.env.PYTHON_SERVICE_API_KEY;
  const callSid = await getCallSid(request);
  const streamUrl = buildWebSocketUrl(pythonServiceUrl, callSid, apiKey || undefined);

  const connect = response.connect();
  const stream = connect.stream({
    url: streamUrl,
    track: 'inbound_track'
  });

  if (apiKey) {
    stream.parameter({ name: 'authToken', value: apiKey });
  }

  response.pause({ length: 5 });

  return new NextResponse(response.toString(), {
    headers: { 'Content-Type': 'text/xml' }
  });
}

