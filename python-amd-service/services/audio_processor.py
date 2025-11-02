"""Audio processing utilities for VoiceGUARD2 FastAPI service."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass
class AudioBufferConfig:
    """Configuration for buffering incoming audio prior to inference."""

    sample_rate: int = 8000
    window_seconds: float = 2.0

    @property
    def window_size_bytes(self) -> int:
        """Return number of bytes required to fill the inference window."""

        return int(self.sample_rate * self.window_seconds)


class AudioBuffer:
    """Simple byte buffer used to accumulate audio prior to inference."""

    def __init__(self, config: AudioBufferConfig) -> None:
        self._config = config
        self._buffer = bytearray()

    @property
    def config(self) -> AudioBufferConfig:
        return self._config

    def append(self, chunk: bytes) -> bool:
        """Append a chunk of audio; return True if the buffer is ready for inference."""

        if not isinstance(chunk, (bytes, bytearray)):
            raise TypeError("AudioBuffer.append expects bytes-like input")

        self._buffer.extend(chunk)
        return len(self._buffer) >= self._config.window_size_bytes

    def extend(self, chunks: Iterable[bytes]) -> bool:
        """Extend the buffer with multiple chunks; returns readiness like `append`."""

        ready = False
        for chunk in chunks:
            ready = self.append(chunk)
        return ready

    def clear(self) -> None:
        """Reset the buffer contents."""

        self._buffer.clear()

    def get_bytes(self, *, reset: bool = True) -> bytes:
        """Return buffered audio as immutable bytes, optionally clearing the buffer."""

        payload = bytes(self._buffer)
        if reset:
            self.clear()
        return payload

    def __len__(self) -> int:  # pragma: no cover - trivial
        return len(self._buffer)

