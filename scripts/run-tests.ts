import 'dotenv/config';

import { prisma } from '@/lib/db/prisma';

interface TestNumber {
  number: string;
  expected: 'human' | 'machine';
  name: string;
}

interface TestResult {
  number: string;
  expected: 'human' | 'machine';
  actual: string | null;
  confidence: number | null;
  duration: number | null;
  correct: boolean;
}

const TEST_NUMBERS: TestNumber[] = [
  { number: '+18007742678', expected: 'machine', name: 'Costco' },
  { number: '+18008066453', expected: 'machine', name: 'Nike' },
  { number: '+18882211161', expected: 'machine', name: 'PayPal' },
  { number: '+919188411420', expected: 'machine', name: 'Sanjay' }
  // Add a verified human number before running end-to-end tests.
];

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const results: TestResult[] = [];

  for (const test of TEST_NUMBERS) {
    console.log(`Running AMD test for ${test.name} (${test.number})`);

    for (let i = 0; i < 5; i += 1) {
      const response = await fetch(`${baseUrl}/api/dial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toNumber: test.number,
          amdStrategy: 'voiceguard'
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const message = await response.text();
        console.error('Dial failed', message);
        continue;
      }

      const { callId, callSid } = (await response.json()) as { callId: string; callSid: string };
      await waitForCallCompletion(callSid, baseUrl);

      const call = await prisma.call.findUnique({ where: { id: callId } });

      if (!call) continue;

      results.push({
        number: test.number,
        expected: test.expected,
        actual: call.amdResult,
        confidence: call.amdConfidence,
        duration: call.duration,
        correct: call.amdResult === test.expected
      });

      await delay(5000);
    }
  }

  printReport(results);
}

async function waitForCallCompletion(callSid: string, baseUrl: string) {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await delay(1000);

    const response = await fetch(`${baseUrl}/api/call-status/${callSid}`, {
      credentials: 'include'
    });

    if (!response.ok) continue;

    const call = (await response.json()) as {
      status: string;
      amdResult?: { label: string } | null;
    };
    if (call.status === 'completed' || call.amdResult?.label) {
      return;
    }
  }
}

function printReport(results: TestResult[]) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const accuracy = total ? (correct / total) * 100 : 0;

  console.log('\n=== AMD Accuracy Report ===');
  console.log(`Total tests: ${total}`);
  console.log(`Correct detections: ${correct}`);
  console.log(`Accuracy: ${accuracy.toFixed(2)}%`);

  const grouped = results.reduce<Record<string, TestResult[]>>((acc, result) => {
    if (!acc[result.number]) acc[result.number] = [];
    acc[result.number].push(result);
    return acc;
  }, {});

  console.log('\nPer-number breakdown:');
  for (const [number, entries] of Object.entries(grouped)) {
    const correctCount = entries.filter((entry) => entry.correct).length;
    const confidenceAvg =
      entries.reduce((sum, entry) => sum + (entry.confidence ?? 0), 0) / entries.length;

    console.log(
      `${number}: ${correctCount}/${entries.length} correct (${(
        (correctCount / entries.length) * 100
      ).toFixed(0)}%) | Avg confidence ${(confidenceAvg * 100).toFixed(1)}%`
    );
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error('AMD test suite failed', error);
  process.exit(1);
});
