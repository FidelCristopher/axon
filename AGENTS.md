# Axon Studio — Agent Guidelines

- Frontend builds (`npm run build`) update `dist/` live; the user only needs to press `Ctrl + R` in Axon Studio.
- Always run `npm run verify` before committing any Axon changes (checks backend syntax, TypeScript/Vite build, live `/api/sessions` regression check for `panel`, and `xterm.js` layout guard).
- Never hide `xterm.js` containers with `display: none` (`hidden`) — always use `opacity-0 pointer-events-none -z-10` so Chromium never resets `.xterm-viewport` scrollTop or zeroes canvas dimensions.
- Backend (`server/axonPiBridge.cjs`) is supervised by `server/axonSupervisor.sh` on port `1425` (auto-restarts in 0.5s if killed).
- **IMPORTANT:** Never run `fuser -k 1425/tcp` or kill `axonPiBridge.cjs` mid-turn when executing inside an Axon Native PTY session, as killing port `1425` terminates the parent WebSocket PTY stream. Commit your changes cleanly and inform the user to restart the bridge or reopen `Axon Studio.exe` if backend code changed.
