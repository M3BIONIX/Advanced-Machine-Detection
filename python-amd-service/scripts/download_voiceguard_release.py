"""CLI helper to download the VoiceGUARD2 model release asset."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

from services.model_downloader import ensure_voiceguard_weights


def main() -> None:
    dotenv_path = Path(__file__).resolve().parent.parent / ".env"
    if dotenv_path.exists():
        load_dotenv(dotenv_path)
    else:
        load_dotenv()

    model_path = Path(os.getenv("MODEL_PATH", "./models/cache")).resolve()
    release_url = os.getenv("VOICEGUARD_RELEASE_URL")
    ensure_voiceguard_weights(model_path, release_url)
    print(f"VoiceGUARD2 assets ready in {model_path}")


if __name__ == "__main__":
    main()

