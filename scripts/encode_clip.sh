#!/usr/bin/env bash
# Encode a simulator recording for the landing page.
#
#   scripts/encode_clip.sh IN.mov NAME
#
# Writes media/NAME.mp4 (H.264, faststart, no audio), media/NAME.webm (AV1,
# kept only when smaller than the MP4) and media/NAME.jpg (the poster, the
# clip's last frame). Long idle stretches from UI-test pacing are squeezed
# out (mpdecimate drops at most IDLE_KEEP frames in a row of a still run, so lower keeps more), and
# the result is scaled to WIDTH px wide at 30 fps.
#
# Env: WIDTH (default 600), CRF (default 30), IDLE_KEEP (default 2),
#      TRIM_START / TRIM_END seconds (default 0).
set -euo pipefail
IN=$1; NAME=$2
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=$ROOT/media
WIDTH=${WIDTH:-600}; CRF=${CRF:-30}; IDLE_KEEP=${IDLE_KEEP:-2}
TRIM_START=${TRIM_START:-0}; TRIM_END=${TRIM_END:-0}
mkdir -p "$OUT"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
LEN=$(python3 -c "print(max(0.5, $DUR - $TRIM_START - $TRIM_END))")
FILTER="fps=30,mpdecimate=hi=200:lo=100:frac=0.1:max=$IDLE_KEEP,setpts=N/30/TB,scale=$WIDTH:-2:flags=lanczos,format=yuv420p"

ffmpeg -v error -y -ss "$TRIM_START" -t "$LEN" -i "$IN" -an -vf "$FILTER" -r 30 \
  -c:v libx264 -preset slow -crf "$CRF" -profile:v high -movflags +faststart "$OUT/$NAME.mp4"
ffmpeg -v error -y -sseof -0.1 -i "$OUT/$NAME.mp4" -frames:v 1 -q:v 4 "$OUT/$NAME.jpg"

if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libsvtav1; then
  ffmpeg -v error -y -i "$OUT/$NAME.mp4" -an -c:v libsvtav1 -crf 42 -preset 6 -svtav1-params log-level=0 "$OUT/$NAME.webm" 2>/dev/null
  if [ "$(stat -f%z "$OUT/$NAME.webm")" -ge "$(stat -f%z "$OUT/$NAME.mp4")" ]; then rm "$OUT/$NAME.webm"; fi
fi

for f in "$OUT/$NAME".*; do
  printf '%-28s %7.0f KB  %ss\n' "$(basename "$f")" "$(($(stat -f%z "$f") / 1024))" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null | cut -c1-5)"
done
