# Petalworks balance model

Standalone simulation of the first-pass economy and factory clock. It does not import the game.

```bash
python3 tools/balance/simulate.py
```

Exit code 0 means the recommended numbers still satisfy the session-length and no-softlock checks. The tables to copy into the game, the reasoning, and the softlock write-up are in `docs/design/BALANCE.md`.

No third-party packages. Production times default to the values in `docs/BRIEF.md`.
