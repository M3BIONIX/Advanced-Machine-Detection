"""FastAPI application exposing VoiceGUARD2 real-time AMD service."""

from __future__ import annotations

import io
import logging
import os
from pathlib import Path
from typing import Any, Dict

import httpx
import librosa
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect

from models.voiceguard_loader import VoiceGUARDDetector
from utils.websocket_handler import MediaStreamSession, StreamConfig


load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
LOGGER = logging.getLogger("voiceguard2.service")
LOGGER.setLevel(logging.DEBUG)


app = FastAPI(title="VoiceGUARD2 AMD Service", version="1.0.0")


detector = VoiceGUARDDetector()

stream_config = StreamConfig(
    sample_rate=int(os.getenv("TWILIO_SAMPLE_RATE", "8000")),
    buffer_seconds=float(os.getenv("AUDIO_BUFFER_SECONDS", "2.0")),
    min_confidence=float(os.getenv("CONFIDENCE_THRESHOLD", "0.75")),
    silence_timeout=float(os.getenv("SILENCE_TIMEOUT_SECONDS", "5")),
    fallback_label=os.getenv("FALLBACK_STRATEGY", "human"),
)

CALLBACK_URL = os.getenv("RESULT_CALLBACK_URL")
CALLBACK_AUTH_TOKEN = (os.getenv("API_KEY") or "").strip() or None

LOGGER.info("VoiceGUARD2 callback configured: RESULT_CALLBACK_URL=%s, API_KEY=%r", CALLBACK_URL, CALLBACK_AUTH_TOKEN)


async def dispatch_detection_result(call_sid: str, payload: Dict[str, Any]) -> None:
    if not CALLBACK_URL:
        LOGGER.warning("RESULT_CALLBACK_URL not configured; skipping dispatch")
        return

    headers: Dict[str, str] = {}
    if CALLBACK_AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {CALLBACK_AUTH_TOKEN}"

    data = {"callSid": call_sid, **payload}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(CALLBACK_URL, json=data, headers=headers)
    except httpx.HTTPError as exc:
        LOGGER.error("Failed to dispatch detection result: %s", exc)


@app.websocket("/ws/audio-stream/{call_sid}")
async def audio_stream_endpoint(websocket: WebSocket, call_sid: str) -> None:
    """Receive audio from Twilio Media Streams and return VoiceGUARD2 detections."""

    query_token = (websocket.query_params.get("token") or "").strip()
    token_validated = False if CALLBACK_AUTH_TOKEN else True

    if CALLBACK_AUTH_TOKEN and query_token:
        if query_token == CALLBACK_AUTH_TOKEN:
            token_validated = True
        else:
            await websocket.close(code=4401)
            LOGGER.warning("Rejected stream for %s due to invalid query token", call_sid)
            return

    await websocket.accept()
    session = MediaStreamSession(detector=detector, config=stream_config)

    try:
        while not session.detection_made:
            message = await websocket.receive_json()
            event_type = message.get("event")

            if event_type == "start":
                if CALLBACK_AUTH_TOKEN and not token_validated:
                    start_payload = message.get("start", {})
                    raw_params = start_payload.get("customParameters") or []
                    LOGGER.debug("Start event received for %s with custom params: %s", call_sid, raw_params)

                    start_token: Optional[str] = None
                    if isinstance(raw_params, dict):
                        start_token = (raw_params.get("authToken") or "").strip()
                    else:
                        for param in raw_params:
                            if isinstance(param, dict) and param.get("name") == "authToken":
                                start_token = (param.get("value") or "").strip()
                                break

                    if start_token == CALLBACK_AUTH_TOKEN:
                        token_validated = True
                        LOGGER.debug("WebSocket auth succeeded via start event for %s", call_sid)
                    else:
                        await websocket.close(code=4401)
                        LOGGER.warning(
                            "Rejected stream for %s due to invalid start token %r",
                            call_sid,
                            start_token,
                        )
                        break
                continue

            if event_type == "media":
                if CALLBACK_AUTH_TOKEN and not token_validated:
                    await websocket.close(code=4401)
                    LOGGER.warning("Rejected stream for %s: media received before auth", call_sid)
                    break

                media = message.get("media", {})
                payload = media.get("payload")
                if not payload:
                    continue

                detection = session.handle_media_payload(payload)
                if detection:
                    await dispatch_detection_result(
                        call_sid,
                        {
                            "label": detection.label,
                            "confidence": detection.confidence,
                            "timestamp": detection.timestamp,
                        },
                    )
                    await websocket.send_json(
                        {
                            "event": "detection_result",
                            "callSid": call_sid,
                            "label": detection.label,
                            "confidence": detection.confidence,
                            "timestamp": detection.timestamp,
                        }
                    )
                    break

            elif event_type == "stop":
                LOGGER.info("Stream stop received for %s", call_sid)
                break

            timeout_result = session.check_silence_timeout()
            if timeout_result:
                LOGGER.info("Silence timeout triggered for %s", call_sid)
                await dispatch_detection_result(
                    call_sid,
                    {
                        "label": timeout_result.label,
                        "confidence": timeout_result.confidence,
                        "timestamp": timeout_result.timestamp,
                    },
                )
                await websocket.send_json(
                    {
                        "event": "detection_result",
                        "callSid": call_sid,
                        "label": timeout_result.label,
                        "confidence": timeout_result.confidence,
                        "timestamp": timeout_result.timestamp,
                    }
                )
                break

    except WebSocketDisconnect:
        LOGGER.warning("WebSocket disconnected for call %s", call_sid)
    except Exception as exc:  # pragma: no cover - defensive logging
        LOGGER.exception("Unexpected streaming error for %s: %s", call_sid, exc)
        await websocket.close(code=1011)


@app.post("/api/predict")
async def predict_audio(file: UploadFile) -> Dict[str, Any]:
    """Synchronous prediction endpoint for offline testing."""

    if not file:
        raise HTTPException(status_code=400, detail="Audio file required")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    prediction = detector.predict(audio_bytes)
    if prediction is None:
        try:
            waveform, sample_rate = librosa.load(io.BytesIO(audio_bytes), sr=None, mono=False)
            prediction = detector.predict_waveform(waveform, sample_rate=sample_rate)
        except Exception as exc:  # pragma: no cover - defensive logging
            LOGGER.exception("Waveform inference failed: %s", exc)
            raise HTTPException(status_code=500, detail="Unable to generate prediction")

    if prediction is None:
        raise HTTPException(status_code=500, detail="Unable to generate prediction")

    return prediction


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Return service health metadata."""

    return {
        "status": "healthy",
        "model": "VoiceGUARD2",
        "device": str(detector.device),
        "min_confidence": stream_config.min_confidence,
    }

