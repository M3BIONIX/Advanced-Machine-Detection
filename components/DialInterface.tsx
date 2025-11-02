'use client';

import { useCallback, useState } from 'react';
import { z } from 'zod';

import { CallStatus } from '@/components/CallStatus';

const phoneSchema = z
  .string()
  .regex(/^\+\d{8,15}$/, 'Enter a valid E.164 number (e.g. +918765432109)');

interface DialResponse {
  success?: boolean;
  callId?: string;
  callSid?: string;
  strategy?: string;
  error?: string;
}

export function DialInterface() {
  const [phoneNumber, setPhoneNumber] = useState('+1');
  const [strategy, setStrategy] = useState<'voiceguard' | 'twilio-native'>('voiceguard');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);

  const handleDial = useCallback(async () => {
    setError('');
    setStatus('Initiating call...');
    setLoading(true);
    setActiveCallSid(null);

    try {
      phoneSchema.parse(phoneNumber);

      const response = await fetch('/api/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toNumber: phoneNumber,
          amdStrategy: strategy
        })
      });

      const data: DialResponse = await response.json();

      if (!response.ok || !data.success || !data.callId || !data.callSid) {
        throw new Error(data.error || 'Failed to initiate call');
      }

      setStatus(`Call initiated via ${data.strategy === 'twilio-native' ? 'Twilio Native AMD' : 'VoiceGUARD2'}`);
      setActiveCallSid(data.callSid);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setError(message);
      setStatus('');
      setLoading(false);
    }
  }, [phoneNumber, strategy]);

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Make a Call</h2>
        <p className="text-sm text-gray-500">Route outbound calls through AMD detection before connecting.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Phone Number</label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
          placeholder="+918765432109"
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={loading}
        />
        <p className="text-xs text-gray-400">Enter any E.164-formatted number (country code + subscriber digits).</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">AMD Strategy</label>
        <select
          value={strategy}
          onChange={(event) => setStrategy(event.target.value as 'voiceguard' | 'twilio-native')}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={loading}
        >
          <option value="voiceguard">VoiceGUARD2 (ML Model)</option>
          <option value="twilio-native">Twilio Native AMD</option>
        </select>
        <p className="text-xs text-gray-400">
          {strategy === 'voiceguard'
            ? 'Hugging Face-powered detection with faster response times.'
            : 'Backup option relying on Twilio\'s built-in answering machine detection.'}
        </p>
      </div>

      <button
        type="button"
        onClick={handleDial}
        disabled={loading || !phoneSchema.safeParse(phoneNumber).success}
        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Calling...' : 'Dial Now'}
      </button>

      {status && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
          <p className="text-sm text-indigo-800">{status}</p>
        </div>
      )}

      {activeCallSid && <CallStatus callSid={activeCallSid} />}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="p-3 bg-gray-50 rounded">
        <p className="text-xs font-semibold text-gray-600 mb-2">Test Numbers</p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>Costco (Voicemail): +18007742678</li>
          <li>Nike (Voicemail): +18008066453</li>
          <li>PayPal (Voicemail): +18882211161</li>
        </ul>
      </div>
    </div>
  );
}
