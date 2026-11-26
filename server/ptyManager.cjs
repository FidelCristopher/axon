const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PTY_HOST_SCRIPT = path.join(__dirname, "ptyHost.py");
const PI_BIN = "/home/fidel/.pi/agent/bin/pi";
const SESSIONS_DIR = "/home/fidel/.pi/agent/sessions/--home-fidel--";
const MAX_BUFFER_BYTES = 2 * 1024 * 1024; // 2 MB rolling ANSI buffer for deep scrollback across Ctrl+R reloads

const ptySessions = new Map();
let statusCallback = null;

function setPtyStatusCallback(cb) {
  statusCallback = cb;
}

function sendInputToPty(nodeId, data) {
  const entry = ptySessions.get(nodeId);
  if (!entry || !entry.proc || !entry.proc.stdin || !entry.proc.stdin.writable) {
    return false;
  }
  try {
    entry.proc.stdin.write(data);
    return true;
  } catch {
    return false;
  }
}

function encodeWsFrame(payloadBuf, opcode = 0x1) {
  const len = payloadBuf.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payloadBuf]);
}

function sendWsText(socket, text) {
  if (!socket || socket.destroyed || !socket.writable) return;
  try {
    socket.write(encodeWsFrame(Buffer.from(text, "utf-8"), 0x1));
  } catch {
    // ignore closed socket
  }
}

function resolveSessionPath(sessionParam) {
  if (!sessionParam || !fs.existsSync(SESSIONS_DIR)) return null;
  const clean = path.basename(String(sessionParam).trim());
  const direct = clean.endsWith(".jsonl") ? path.join(SESSIONS_DIR, clean) : null;
  if (direct && fs.existsSync(direct)) return direct;

  const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".jsonl"));
  const found = files.find((f) => f === clean || f.includes(clean));
  return found ? path.join(SESSIONS_DIR, found) : null;
}

function getOrSpawnPty({ nodeId, cwd, sessionFile, cols = 120, rows = 34, restart = false }) {
  if (restart && ptySessions.has(nodeId)) {
    killPtySession(nodeId);
  }

  if (ptySessions.has(nodeId)) {
    const existing = ptySessions.get(nodeId);
    if (existing.proc && !existing.proc.killed && existing.proc.exitCode === null) {
      return existing;
    }
    ptySessions.delete(nodeId);
  }

  const safeCwd = cwd && fs.existsSync(cwd) ? cwd : "/mnt/c/Users/Pongo/axon";
  const resolvedSession = resolveSessionPath(sessionFile);

  const cmdArgs = [PTY_HOST_SCRIPT, safeCwd, String(cols), String(rows), PI_BIN];
  if (resolvedSession) {
    cmdArgs.push("--session", resolvedSession);
  }

  console.log(
    `[Axon Native PTY] Spawning real Pi CLI for [${nodeId}] in ${safeCwd}` +
      (resolvedSession ? ` (--session ${path.basename(resolvedSession)})` : " (new session)")
  );

  const proc = spawn("python3", cmdArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  const entry = {
    nodeId,
    cwd: safeCwd,
    sessionFile: resolvedSession,
    proc,
    clients: new Set(),
    bufferChunks: [],
    bufferSize: 0,
    startedAt: Date.now(),
    isWorking: false,
    idleTimer: null,
  };

  const setEntryWorking = (working) => {
    if (entry.isWorking === working) return;
    entry.isWorking = working;
    if (typeof statusCallback === "function") {
      try {
        statusCallback({
          nodeId: entry.nodeId,
          sessionFile: entry.sessionFile ? path.basename(entry.sessionFile) : "",
          cwd: entry.cwd,
          status: working ? "WORKING" : "IDLE",
        });
      } catch {
        // ignore
      }
    }
  };

  const appendToBuffer = (str) => {
    const bytes = Buffer.byteLength(str, "utf-8");
    entry.bufferChunks.push(str);
    entry.bufferSize += bytes;
    while (entry.bufferSize > MAX_BUFFER_BYTES && entry.bufferChunks.length > 1) {
      const removed = entry.bufferChunks.shift();
      entry.bufferSize -= Buffer.byteLength(removed, "utf-8");
    }
  };

  const broadcastOutput = (chunk) => {
    const str = chunk.toString("utf-8");
    appendToBuffer(str);

    // Detect live Pi TUI activity (streaming output / spinner) -> mark node WORKING, settle to IDLE after 2.5s quiet
    if (str.length > 8) {
      setEntryWorking(true);
      if (entry.idleTimer) clearTimeout(entry.idleTimer);
      entry.idleTimer = setTimeout(() => {
        setEntryWorking(false);
      }, 2500);
    }

    const frame = encodeWsFrame(Buffer.from(JSON.stringify({ type: "output", data: str }), "utf-8"), 0x1);
    for (const sock of entry.clients) {
      if (!sock.destroyed && sock.writable) {
        try {
          sock.write(frame);
        } catch {
          entry.clients.delete(sock);
        }
      } else {
        entry.clients.delete(sock);
      }
    }
  };

  proc.stdout.on("data", broadcastOutput);
  proc.stderr.on("data", broadcastOutput);

  proc.on("exit", (code) => {
    console.log(`[Axon Native PTY] Process exited for [${nodeId}] (code=${code})`);
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    setEntryWorking(false);
    const exitMsg = `\r\n\x1b[33m[Pi session exited (code ${code ?? 0}). Click "Restart Pi" to launch again.]\x1b[0m\r\n`;
    broadcastOutput(Buffer.from(exitMsg, "utf-8"));
    ptySessions.delete(nodeId);
  });

  ptySessions.set(nodeId, entry);
  return entry;
}

function killPtySession(nodeId) {
  const entry = ptySessions.get(nodeId);
  if (!entry) return false;
  try {
    entry.proc.kill("SIGTERM");
  } catch {
    // ignore
  }
  ptySessions.delete(nodeId);
  return true;
}

function resizePty(entry, cols, rows) {
  if (!entry || !entry.proc || !entry.proc.stdin || !entry.proc.stdin.writable) return;
  const c = Math.max(20, Math.min(400, Number(cols) || 120));
  const r = Math.max(5, Math.min(200, Number(rows) || 34));
  try {
    entry.proc.stdin.write(`\x1b]9999;${c};${r}\x07`);
  } catch {
    // ignore
  }
}

function attachPtyWebSocket(httpServer) {
  httpServer.on("upgrade", (req, socket) => {
    const url = new URL(req.url, "http://127.0.0.1:1425");
    if (url.pathname !== "/ws/pty") {
      socket.destroy();
      return;
    }

    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    const accept = crypto
      .createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");

    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const nodeId = url.searchParams.get("nodeId") || "default";
    const cwd = url.searchParams.get("cwd") || "/mnt/c/Users/Pongo/axon";
    const sessionFile = url.searchParams.get("sessionFile") || "";
    const cols = parseInt(url.searchParams.get("cols") || "120", 10) || 120;
    const rows = parseInt(url.searchParams.get("rows") || "34", 10) || 34;
    const restart = url.searchParams.get("restart") === "1";

    const entry = getOrSpawnPty({ nodeId, cwd, sessionFile, cols, rows, restart });
    entry.clients.add(socket);

    // Replay rolling buffer so reopening a minimized terminal immediately restores live screen
    if (entry.bufferChunks.length > 0) {
      sendWsText(socket, JSON.stringify({ type: "output", data: entry.bufferChunks.join("") }));
    }
    resizePty(entry, cols, rows);

    // Parse incoming RFC 6455 masked frames
    let recvBuf = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      recvBuf = Buffer.concat([recvBuf, chunk]);

      while (recvBuf.length >= 2) {
        const b0 = recvBuf[0];
        const b1 = recvBuf[1];
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (recvBuf.length < 4) return;
          payloadLen = recvBuf.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (recvBuf.length < 10) return;
          payloadLen = Number(recvBuf.readBigUInt64BE(2));
          offset = 10;
        }

        const maskLen = masked ? 4 : 0;
        if (recvBuf.length < offset + maskLen + payloadLen) return;

        let payload = recvBuf.subarray(offset + maskLen, offset + maskLen + payloadLen);
        if (masked) {
          const mask = recvBuf.subarray(offset, offset + 4);
          const unmasked = Buffer.alloc(payloadLen);
          for (let i = 0; i < payloadLen; i++) {
            unmasked[i] = payload[i] ^ mask[i % 4];
          }
          payload = unmasked;
        }

        recvBuf = recvBuf.subarray(offset + maskLen + payloadLen);

        if (opcode === 0x8) {
          // Close frame
          socket.end();
          return;
        } else if (opcode === 0x9) {
          // Ping -> Pong
          socket.write(encodeWsFrame(payload, 0xA));
        } else if (opcode === 0x1 || opcode === 0x2) {
          try {
            const msg = JSON.parse(payload.toString("utf-8"));
            if (msg.type === "input" && typeof msg.data === "string") {
              if (entry.proc && entry.proc.stdin && entry.proc.stdin.writable) {
                entry.proc.stdin.write(msg.data);
              }
            } else if (msg.type === "resize") {
              resizePty(entry, msg.cols, msg.rows);
            }
          } catch {
            // ignore malformed JSON
          }
        }
      }
    });

    const cleanup = () => {
      entry.clients.delete(socket);
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);
  });
}

module.exports = {
  attachPtyWebSocket,
  killPtySession,
  sendInputToPty,
  setPtyStatusCallback,
  getActivePtyCount: () => ptySessions.size,
};
