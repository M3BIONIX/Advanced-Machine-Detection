"""Download utilities for retrieving VoiceGUARD2 model artifacts."""

from __future__ import annotations

import logging
import os
import shutil
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

import requests

try:
    import py7zr  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    py7zr = None


LOGGER = logging.getLogger(__name__)

CHUNK_SIZE = 1 << 14  # 16 KiB


def ensure_voiceguard_weights(target_dir: Path, release_url: Optional[str] = None) -> None:
    """Ensure VoiceGUARD2 artifacts are present in ``target_dir``.

    Parameters
    ----------
    target_dir:
        Destination directory that should contain the unpacked model files.
    release_url:
        Optional override for the release asset URL. Defaults to
        ``VOICEGUARD_RELEASE_URL`` environment variable.
    """

    release_url = release_url or os.getenv("VOICEGUARD_RELEASE_URL")

    if not release_url:
        raise RuntimeError(
            "VOICEGUARD_RELEASE_URL is not configured. Set it in the environment "
            "or pass release_url explicitly before starting the service."
        )

    target_dir = target_dir.resolve()
    config_path = target_dir / "config.json"
    if config_path.exists():
        LOGGER.info("VoiceGUARD2 assets already present at %s", target_dir)
        return

    LOGGER.info("VoiceGUARD2 assets missing; downloading from %s", release_url)
    download_and_extract_release(release_url, target_dir)

    if not config_path.exists():
        raise FileNotFoundError(
            f"VoiceGUARD2 download completed but config.json missing in {target_dir}. "
            "Check the release asset contents."
        )


def download_and_extract_release(release_url: str, destination: Path) -> None:
    """Download the VoiceGUARD2 release asset and extract it into ``destination``."""

    headers = {
        "User-Agent": "VoiceGUARD2-AMD-Service/1.0",
        "Accept": "application/octet-stream",
    }

    with tempfile.TemporaryDirectory() as tmp_dir_str:
        tmp_dir = Path(tmp_dir_str)
        archive_path = tmp_dir / _derive_archive_name(release_url)

        github_token = os.getenv("GITHUB_TOKEN")
        if github_token:
            headers["Authorization"] = f"Bearer {github_token}"

        LOGGER.debug("Downloading VoiceGUARD2 release to %s", archive_path)
        with requests.get(release_url, stream=True, headers=headers, timeout=120) as response:
            response.raise_for_status()
            with archive_path.open("wb") as handle:
                for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                    if chunk:
                        handle.write(chunk)

        extraction_root = tmp_dir / "extracted"
        extraction_root.mkdir(parents=True, exist_ok=True)

        suffix = archive_path.suffix.lower()

        if zipfile.is_zipfile(archive_path):
            LOGGER.debug("Extracting zip archive")
            with zipfile.ZipFile(archive_path) as zipped:
                zipped.extractall(extraction_root)
        elif tarfile.is_tarfile(archive_path):
            LOGGER.debug("Extracting tar archive")
            with tarfile.open(archive_path) as tar:
                tar.extractall(extraction_root)
        elif suffix == ".7z":
            if py7zr is None:
                raise RuntimeError(
                    "py7zr is required to extract .7z archives. Install it or provide the "
                    "model files manually."
                )
            LOGGER.debug("Extracting 7z archive")
            with py7zr.SevenZipFile(archive_path, mode="r") as seven_zip:
                seven_zip.extractall(path=extraction_root)
        else:
            LOGGER.debug("Archive format not recognised; treating as raw file")
            extraction_root = archive_path.parent

        content_root = _locate_model_root(extraction_root)

        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(content_root, destination)


def _derive_archive_name(release_url: str) -> str:
    name = Path(release_url.rstrip("/ ")).name or "voiceguard2_download"
    return name


def _locate_model_root(extraction_root: Path) -> Path:
    for config_file in extraction_root.rglob("config.json"):
        return config_file.parent
    return extraction_root

