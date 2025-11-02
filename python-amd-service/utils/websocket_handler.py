"""Helpers for Twilio Media Stream WebSocket handling."""

from __future__ import annotations

import base64
import time
from dataclasses import dataclass
from typing import Optional

from services.audio_processor import AudioBuffer, AudioBufferConfig


@dataclass
class StreamConfig:
    """Runtime options for media-stream processing."""

    sample_rate: int = 8000
    buffer_seconds: float = 2.0
    min_confidence: float = 0.75
    silence_timeout: float = 5.0
    fallback_label: str = "human"


@dataclass
class DetectionResult:
    label: str
    confidence: float
    timestamp: float


class MediaStreamSession:
    """Accumulates audio from a Twilio Media Stream for AMD."""

    def __init__(self, detector, config: StreamConfig) -> None:
        self.detector = detector
        self.config = config
        self.buffer = AudioBuffer(
            AudioBufferConfig(
                sample_rate=config.sample_rate, window_seconds=config.buffer_seconds
            )
        )
        self.detection_made = False
        self._last_media_time = time.monotonic()

    def handle_media_payload(self, payload_b64: str) -> Optional[DetectionResult]:
        """Decode payload, run inference when ready, and return detection."""

        chunk = base64.b64decode(payload_b64)
        self._last_media_time = time.monotonic()

        if not self.buffer.append(chunk):
            return None

        audio_bytes = self.buffer.get_bytes()
        result = self.detector.predict(audio_bytes)
        if result is None:
            return None

        label = result.get("label") or self.config.fallback_label
        confidence = float(result.get("confidence", 0.0))

        if confidence < self.config.min_confidence:
            return None

        self.detection_made = True
        return DetectionResult(label=label, confidence=confidence, timestamp=time.time())

    def check_silence_timeout(self) -> Optional[DetectionResult]:
        """Return a fallback detection if the stream falls silent for too long."""

        if self.detection_made:
            return None

        elapsed = time.monotonic() - self._last_media_time
        if elapsed >= self.config.silence_timeout:
            self.detection_made = True
            return DetectionResult(
                label=self.config.fallback_label,
                confidence=0.0,
                timestamp=time.time(),
            )
        return None

