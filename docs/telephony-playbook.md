# Telephony Playbook

## 1. Twilio Configuration
- Create a Programmable Voice application that points to `POST /api/twiml/connect-stream`
- Set `StatusCallback` to `POST /api/webhooks/call-status`
- Verify caller ID (`TWILIO_PHONE_NUMBER`) and add any destination numbers required for testing
- Optional: enable secure RTP if mandated by compliance

## 2. VoiceGUARD2 Service
- Deploy `python-amd-service` (Docker or bare metal)
- Expose WebSocket endpoint: `wss://<python-service>/ws/audio-stream/{CallSid}?token=<API_KEY>`
- Configure environment:
  - `API_KEY` (shared with Next.js `PYTHON_SERVICE_API_KEY`)
  - `RESULT_CALLBACK_URL=https://<app>/api/amd-result`
  - `MODEL_PATH` pointing to persistent storage for weights
- Monitor `/health` and inference latency; autoscale if confidence degrades

## 3. Local Development Tips
- Launch tunnel: `ngrok http 3000`
- Point Twilio application to the ngrok URL (both connect and status callbacks)
- Run `uvicorn app:app --reload` inside `python-amd-service`
- Use Twilio verified numbers before dialing external destinations

## 4. Accuracy Analysis
- Run `npm run call:test-suite` for full regression (5 calls per number)
- Use `npm run call:test-amd` for quick smoke tests against voicemail targets
- Export results to BI tooling or document deltas in `docs/`

## 5. Incident Response
- Rotate Twilio credentials and `PYTHON_SERVICE_API_KEY` on suspicious activity
- Pause outbound calls via Twilio console to halt traffic
- Inspect `Call` records (status, amdResult, confidence) for anomalies
- Review Python service logs for inference errors or missed callbacks
