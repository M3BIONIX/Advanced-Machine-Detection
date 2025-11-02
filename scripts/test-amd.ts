import 'dotenv/config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface TestNumber {
  name: string;
  number: string;
}

const TEST_NUMBERS = {
  voicemail: [
    { name: 'Costco', number: '+18007742678' },
    { name: 'Nike', number: '+18008066453' },
    { name: 'PayPal', number: '+18882211161' }
  ] satisfies TestNumber[],
  human: [{ name: 'Personal', number: process.env.TEST_PERSONAL_NUMBER || '' }].filter(
    (entry) => entry.number
  ) satisfies TestNumber[]
};

async function dial(number: string) {
  const response = await fetch(`${BASE_URL}/api/dial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: number,
      amdStrategy: 'voiceguard'
    }),
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Dial failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as { callSid: string; callId: string };
  return payload;
}

async function waitForDetection(callSid: string, timeoutMs = 45_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await delay(1000);
    const response = await fetch(`${BASE_URL}/api/call-status/${callSid}`, {
      credentials: 'include'
    });

    if (!response.ok) continue;

    const data = (await response.json()) as {
      status: string;
      amdResult: { label: string; confidence: number } | null;
    };

    if (data.amdResult) {
      return data.amdResult;
    }
  }

  throw new Error('Detection timed out');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== VoiceGUARD2 AMD Test Harness ===');

  for (const category of Object.keys(TEST_NUMBERS) as (keyof typeof TEST_NUMBERS)[]) {
    for (const test of TEST_NUMBERS[category]) {
      console.log(`\nDialing ${test.name} (${category}) → ${test.number}`);

      try {
        const { callSid } = await dial(test.number);
        const detection = await waitForDetection(callSid);
        console.log(
          `Result: ${detection.label.toUpperCase()} (${(detection.confidence * 100).toFixed(1)}% confidence)`
        );
      } catch (error) {
        console.error('Test failed:', error);
      }
    }
  }
}

main().catch((error) => {
  console.error('VoiceGUARD2 test runner failed', error);
  process.exit(1);
});

