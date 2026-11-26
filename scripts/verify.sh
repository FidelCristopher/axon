#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/fidel/.local/share/pi-node/current/bin:$PATH"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== [1/4] Syntax check backend scripts ==="
node --check server/axonPiBridge.cjs
node --check server/ptyManager.cjs
python3 -m py_compile server/ptyHost.py
echo "Backend syntax: OK"

echo "=== [2/4] TypeScript + Vite production build ==="
npm run build

echo "=== [3/4] Verify live Axon Bridge health & session catalog ==="
if curl -sf http://127.0.0.1:1425/api/health >/dev/null 2>&1; then
  node -e '
    (async () => {
      const t0 = Date.now();
      const res = await fetch("http://127.0.0.1:1425/api/sessions");
      const dt = Date.now() - t0;
      const data = await res.json();
      if (!Array.isArray(data.sessions) || data.sessions.length === 0) {
        throw new Error("GET /api/sessions returned empty list!");
      }
      const hasPanel = data.sessions.some((s) => s.name === "panel");
      if (!hasPanel) {
        throw new Error("Regression: session \"panel\" missing from /api/sessions!");
      }
      console.log(`Sessions check OK: ${data.sessions.length} sessions in ${dt}ms (panel present)`);
    })().catch((e) => { console.error(e); process.exit(1); });
  '
else
  echo "Bridge offline (skipped live check)"
fi

echo "=== [4/4] Guard check: no display:none/hidden on xterm.js panes ==="
if grep -q "isActiveVisible ? 'flex' : 'hidden'" src/components/PeekTerminalModal.tsx; then
  echo "ERROR: Found 'hidden' (display:none) on xterm.js pane! Use opacity-0 pointer-events-none instead."
  exit 1
fi
echo "ALL AXON VERIFICATION CHECKS PASSED!"
