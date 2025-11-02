"""VoiceGUARD2 model loading and inference utilities."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Sequence, Union

import librosa
import numpy as np
import torch
import torchaudio
from transformers import AutoConfig, AutoFeatureExtractor, AutoModelForAudioClassification

from services.model_downloader import ensure_voiceguard_weights


LOGGER = logging.getLogger(__name__)


DEFAULT_LOCAL_SUBDIR = "voiceguard2"


def _ensure_model_files(local_dir: Path) -> Path:
    """Ensure the VoiceGUARD2 assets exist locally, downloading if required."""

    config_path = local_dir / "config.json"
    if config_path.exists():
        return local_dir

    ensure_voiceguard_weights(local_dir)
    return local_dir


def _decode_mulaw(audio_bytes: bytes, sample_rate: int) -> tuple[torch.Tensor, int]:
    """Decode mu-law audio bytes into a mono waveform tensor in float32."""

    if not audio_bytes:
        raise ValueError("Empty audio payload provided to mu-law decoder")

    encoded = torch.frombuffer(audio_bytes, dtype=torch.uint8).to(torch.float32)
    waveform = torchaudio.functional.mu_law_decoding(encoded, quantization_channels=256)
    waveform = waveform.unsqueeze(0)  # (1, num_samples)
    return waveform, sample_rate


def _resample_if_needed(waveform: torch.Tensor, source_rate: int, target_rate: int) -> torch.Tensor:
    if source_rate == target_rate:
        return waveform

    return torchaudio.functional.resample(waveform, source_rate, target_rate)


@dataclass
class InferenceOutput:
    label: str
    confidence: float


class VoiceGUARDDetector:
    """Wrapper around VoiceGUARD2 model providing convenient prediction API."""

    def __init__(
        self,
        model_path: Optional[Union[str, Path]] = None,
        target_sample_rate: int = 16000,
    ) -> None:
        model_root = Path(model_path or os.getenv("MODEL_PATH", f"./models/{DEFAULT_LOCAL_SUBDIR}"))
        model_root = model_root.resolve()

        LOGGER.info("Loading VoiceGUARD2 assets from %s", model_root)
        _ensure_model_files(model_root)

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.target_sample_rate = target_sample_rate

        self.config = AutoConfig.from_pretrained(model_root)
        self.feature_extractor = AutoFeatureExtractor.from_pretrained(model_root)
        self.model = AutoModelForAudioClassification.from_pretrained(model_root, config=self.config).to(self.device)
        self.model.eval()

        self.id2label = self.config.id2label or {0: "human", 1: "machine"}

    def preprocess_audio(
        self,
        audio_bytes: Union[bytes, Sequence[bytes]],
        sample_rate: int = 8000,
    ) -> np.ndarray:
        """Decode and resample audio into the feature extractor's expected format."""

        if isinstance(audio_bytes, (list, tuple)):
            combined = b"".join(audio_bytes)
        else:
            combined = bytes(audio_bytes)

        waveform, _ = _decode_mulaw(combined, sample_rate)
        waveform = _resample_if_needed(waveform, sample_rate, self.target_sample_rate)

        waveform_np = waveform.squeeze(0).cpu().numpy().astype(np.float32)
        return waveform_np

    def preprocess_waveform(self, waveform: np.ndarray, sample_rate: int) -> np.ndarray:
        """Take arbitrary waveform array and convert to target sample rate mono."""

        if waveform.ndim > 1:
            waveform = np.mean(waveform, axis=0)

        if sample_rate != self.target_sample_rate:
            waveform = librosa.resample(waveform, orig_sr=sample_rate, target_sr=self.target_sample_rate)

        return waveform.astype(np.float32)

    def _run_inference(self, waveform_np: np.ndarray) -> dict:
        inputs = self.feature_extractor(
            waveform_np,
            sampling_rate=self.target_sample_rate,
            return_tensors="pt",
        )
        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.no_grad():
            logits = self.model(**inputs).logits

        probabilities = torch.nn.functional.softmax(logits, dim=-1)
        confidence, prediction = torch.max(probabilities, dim=-1)

        label = self.id2label.get(prediction.item(), "unknown")
        return {"label": label.lower(), "confidence": float(confidence.item())}

    def predict(
        self,
        audio_chunk: Union[bytes, Sequence[bytes]],
        sample_rate: int = 8000,
    ) -> Optional[dict]:
        """Run inference on an audio chunk and return label/confidence."""

        if audio_chunk is None:
            return None

        try:
            waveform_np = self.preprocess_audio(audio_chunk, sample_rate=sample_rate)
        except Exception as exc:
            LOGGER.warning("Failed to preprocess audio: %s", exc)
            return None

        return self._run_inference(waveform_np)

    def predict_waveform(self, waveform: np.ndarray, sample_rate: int) -> Optional[dict]:
        """Run inference on raw waveform data for offline testing."""

        try:
            processed = self.preprocess_waveform(waveform, sample_rate)
        except Exception as exc:
            LOGGER.warning("Failed to preprocess waveform: %s", exc)
            return None

        return self._run_inference(processed)

