#!/usr/bin/env bash
# Axon Studio Self-Healing Bridge Supervisor
# Automatically respawns axonPiBridge.cjs within 0.5s if it ever exits or is killed.

LOCK_FILE="/tmp/axon-supervisor.pid"
NODE_BIN="/home/fidel/.local/share/pi-node/current/bin/node"
BRIDGE_JS="/mnt/c/Users/Pongo/axon/server/axonPiBridge.cjs"
LOG_FILE="/tmp/axon-pi-bridge.log"

# If another supervisor is already running, stay alive quietly (0% CPU)
# so Axon Studio.exe's hidden wsl.exe process keeps WSL2 alive even if WezTerm is closed!
if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    exec tail -f /dev/null
  fi
fi

echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

while true; do
  # Only spawn if port 1425 is not already occupied by a healthy bridge
  if ! curl -sf http://127.0.0.1:1425/api/health >/dev/null 2>&1; then
    echo "[Axon Supervisor] Starting axonPiBridge.cjs ($(date '+%H:%M:%S'))..." >> "$LOG_FILE"
    "$NODE_BIN" "$BRIDGE_JS" >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    echo "[Axon Supervisor] Bridge exited (code=$EXIT_CODE). Auto-restarting in 0.5s..." >> "$LOG_FILE"
  fi
  sleep 0.5
done
