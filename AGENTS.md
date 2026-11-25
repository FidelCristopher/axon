# Axon Studio — Agent Guidelines

- Frontend builds (`npm run build`) update `dist/` live; the user only needs to press `Ctrl + R` in Axon Studio.
- Backend (`server/axonPiBridge.cjs`) is supervised by `server/axonSupervisor.sh` on port `1425` (auto-restarts in 0.5s if killed).
- **IMPORTANT:** Never run `fuser -k 1425/tcp` or kill `axonPiBridge.cjs` mid-turn when executing inside an Axon Native PTY session, as killing port `1425` terminates the parent WebSocket PTY stream. Commit your changes cleanly and inform the user to restart the bridge or reopen `Axon Studio.exe` if backend code changed.
