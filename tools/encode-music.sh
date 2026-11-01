#!/bin/sh
# Re-encodes the audio team's music loop (assets/audio/music.ogg, untouched source) into the
# lighter mono copy the game actually streams. Run after the source changes; commit the output.
set -e
cd "$(dirname "$0")/.."
mkdir -p src/assets/audio-lite
ffmpeg -y -loglevel error -i assets/audio/music.ogg -ac 1 -c:a libvorbis -q:a 1 src/assets/audio-lite/music.ogg
ffmpeg -y -loglevel error -i assets/audio/music.ogg -ac 1 -c:a libmp3lame -b:a 64k src/assets/audio-lite/music.mp3
ls -la src/assets/audio-lite
