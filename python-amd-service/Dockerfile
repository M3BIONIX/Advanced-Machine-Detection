FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ARG VOICEGUARD_RELEASE_URL
ENV VOICEGUARD_RELEASE_URL=${VOICEGUARD_RELEASE_URL}

RUN python -m scripts.download_voiceguard_release
RUN python -c "from models.voiceguard_loader import VoiceGUARDDetector; VoiceGUARDDetector()"

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

