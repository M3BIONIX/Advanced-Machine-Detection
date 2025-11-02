'use client';

import { useEffect, useState } from 'react';

interface CallStatusProps {
  callSid: string;
}

interface CallStatusResponse {
  status: string;
  amdResult: {
    label: string;
    confidence: number;
  } | null;
}

export function CallStatus({ callSid }: CallStatusProps) {
  const [status, setStatus] = useState('Dialing…');
  const [amdResult, setAmdResult] = useState<CallStatusResponse['amdResult']>(null);

  useEffect(() => {
    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/call-status/${callSid}`);
        if (!response.ok) return;

        const data: CallStatusResponse = await response.json();

        if (!mounted) return;
        setStatus(data.status);

        if (data.amdResult) {
          setAmdResult(data.amdResult);
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Call status poll failed:', error);
      }
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [callSid]);

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3">
      <div className="text-sm font-medium text-gray-700">Status: {status}</div>
      {amdResult && (
        <div className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm">
          <span>{amdResult.label === 'human' ? '✓ Human' : '✗ Machine'}</span>
          <span className="text-gray-500">{(amdResult.confidence * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

