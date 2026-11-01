# Revisions from the producer


## 2026-11-01 15:30 UK — sound set landed
- The sound set is merged into main and pulled locally under `assets/audio/` (ogg + mp3 fallback). `assets/audio/AUDIO_MANIFEST.md` lists every cue key, loop flag, suggested gain and when to play it, plus a mapping from the old names in `docs/ASSET_SPECS.md` §11.
- When you reach the audio step, wire these in using the manifest (respect the suggested gains, music off until first interaction, a mute toggle that persists in the save). Don't edit files under `assets/audio/`; ask in QUESTIONS.md if a cue is missing.
- Real art from the art team is in progress (grass, belts, daisy beds, bundling and packing machines so far, and it looks on-brief). Keep your interim art pipeline swappable by filename per ASSET_SPECS.md; I'll drop accepted sprites into `assets/art/` and note it here.
