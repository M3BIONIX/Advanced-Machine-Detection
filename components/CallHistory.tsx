import type { Prisma } from '@prisma/client';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  hour: 'numeric',
  minute: '2-digit'
});

type CallWithEvents = Prisma.CallGetPayload<{ include: { amdEvents: true } }>; 

interface CallHistoryProps {
  calls: CallWithEvents[];
}

function formatStrategy(strategy: string) {
  if (strategy === 'voiceguard') return 'VoiceGUARD2';
  if (strategy === 'twilio-native') return 'Twilio Native';
  return strategy;
}

export function CallHistory({ calls }: CallHistoryProps) {
  if (!calls.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        No calls have been placed yet. Dial a number to see results here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Dialed</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Result</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Confidence</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Duration</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {calls.map((call) => (
            <tr key={call.id}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{call.toNumber}</td>
              <td className="px-4 py-3 text-sm text-gray-700">
                {call.amdResult ? call.amdResult.toUpperCase() : 'PENDING'}
                <span className="block text-xs text-gray-400">{formatStrategy(call.amdStrategy)}</span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                  {call.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                {call.amdConfidence !== null && call.amdConfidence !== undefined
                  ? `${Math.round(call.amdConfidence * 100)}%`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                {call.duration ? `${call.duration}s` : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {dateFormatter.format(new Date(call.updatedAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
