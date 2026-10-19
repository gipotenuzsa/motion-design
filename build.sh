#!/usr/bin/env bash
# Full pipeline: soundtrack -> frames (4 parallel Chromium workers) -> final mux with film grain.
set -euo pipefail
cd "$(dirname "$0")"
python3 audio.py
node render.mjs video 4
ffmpeg -y -loglevel error -f concat -safe 0 -i out/parts.txt -i out/audio.wav \
  -vf "noise=alls=4:allf=t+u,format=yuv420p" \
  -c:v libx264 -preset slow -crf 21 -profile:v high -movflags +faststart \
  -c:a aac -b:a 256k -shortest motion.mp4
echo "-> motion.mp4"
