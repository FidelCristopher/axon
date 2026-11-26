const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile, execFileSync, spawn } = require("child_process");
const {
  attachPtyWebSocket,
  killPtySession,
  sendInputToPty,
  setPtyStatusCallback,
  getActivePtyCount,
} = require("./ptyManager.cjs");
const {
  createAgentSessionServices,
  createAgentSessionFromServices,
  SessionManager,
} = require("/home/fidel/.pi/agent/install/releases/1.6.0/node_modules/@earendil-works/pi-coding-agent");

const PORT = 1425;
const SESSIONS_DIR = "/home/fidel/.pi/agent/sessions/--home-fidel--";
const activeSessions = new Map();
const servicesCache = new Map();
const nodeRuntimeState = new Map(); // Tracks live background execution per node for seamless minimize/reopen
const sseClients = new Set();
let discordPresenceState = {
  active: false,
  sessionName: "",
  category: "Standby",
  updatedAt: Date.now(),
};

// ============================================================================
// JARVIS TELEGRAM BOT <-> AXON STUDIO 2-WAY BRIDGE
// ============================================================================
const TELEGRAM_BOT_TOKEN =
  process.env.JARVIS_BOT_TOKEN || "9066504208:AAFHUFWIAW00z2Zk6snbGv2xP7lCEs7yH1k";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_OWNER_FILE = path.join(os.homedir(), ".pi", "agent", "telegram_owner.json");

const AXON_NODES = {
  "hub-main": {
    label: "Hub Utama (ChineseLearning)",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning",
    sessionId: "9d8a42bd-be72-4036-82ac-daccb1d64d3c",
  },
  "node-dev-1": {
    label: "Dev 1 (Belajar)",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-part1",
    sessionId: "4f28aa1b-9e41-4172-8801-7fa8bc31889a",
  },
  "node-dev-2": {
    label: "Dev 2 (Cerita)",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-part2",
    sessionId: "8c91024e-128a-4f51-b019-33aa91b17cc1",
  },
  "node-designer": {
    label: "Designer (Aset)",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/halohanzi-assets",
    sessionId: "e5518b9c-7201-49b8-9311-190ab751b32f",
  },
  "node-qa": {
    label: "QA & Tester",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning",
    sessionId: "b71239aa-5529-410a-8120-cf918a22114d",
  },
  "node-axon": {
    label: "Axon Studio",
    cwd: "/mnt/c/Users/Pongo/axon",
    sessionId: "node-axon",
  },
  "node-matcha": {
    label: "Matcha Showcase",
    cwd: "/mnt/c/Users/Pongo/matcha-showcase",
    sessionId: "node-matcha",
  },
};

const ROLE_ALIASES = {
  "/hub": "hub-main",
  "/dev1": "node-dev-1",
  "/dev2": "node-dev-2",
  "/designer": "node-designer",
  "/qa": "node-qa",
  "/axon": "node-axon",
  "/matcha": "node-matcha",
};

let telegramActiveNode = "hub-main";
const telegramPendingReplies = new Map(); // nodeId -> { chatId, buffer, label, cwd }
let telegramOnline = false;
let telegramLastPollAt = null;
let cachedSessionList = []; // refreshed when user opens /sessions

function normalizeUserPath(rawPath) {
  let p = String(rawPath || "").trim().replace(/^["']|["']$/g, "");
  // Convert Windows C:\Users\... -> /mnt/c/Users/...
  const winMatch = p.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (winMatch) {
    const drive = winMatch[1].toLowerCase();
    const rest = winMatch[2].replace(/\\/g, "/");
    p = `/mnt/${drive}/${rest}`;
  }
  return p;
}

function listRecentPiSessions(limit = 30) {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const files = fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => {
      const full = path.join(SESSIONS_DIR, f);
      const st = fs.statSync(full);
      return { file: f, full, mtimeMs: st.mtimeMs, sizeKb: Math.max(1, Math.round(st.size / 1024)) };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit);

  return files.map((item) => {
    let cwd = "/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning";
    let name = item.file.replace(/\.jsonl$/, "").slice(-12);
    try {
      const head = fs.readFileSync(item.full, "utf-8").slice(0, 3000);
      const lines = head.split("\n").filter((l) => l.trim());
      for (const line of lines.slice(0, 10)) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === "session" && obj.cwd) cwd = obj.cwd;
          if (obj.type === "session_info" && obj.name) name = obj.name;
        } catch {}
      }
    } catch {}
    const folder = path.basename(cwd) || cwd;
    return {
      nodeId: `sess:${item.file.replace(/\.jsonl$/, "")}`,
      file: item.file,
      label: `${name} [${folder}]`,
      cwd,
      sizeKb: item.sizeKb,
    };
  });
}

function getActiveNodeConfig(nodeId = telegramActiveNode) {
  if (AXON_NODES[nodeId]) return AXON_NODES[nodeId];
  return AXON_NODES["hub-main"];
}

function getNodesKeyboard() {
  const rows = Object.entries(AXON_NODES).map(([id, info]) => {
    const folder = path.basename(info.cwd) || info.cwd;
    return [
      {
        text: `${id === telegramActiveNode ? "[AKTIF] " : ""}${info.label} • /${folder}`,
        callback_data: `axon_node:${id}`,
      },
    ];
  });
  rows.push([
    {
      text: ">> Pilih dari Real Pi Sessions (.jsonl) <<",
      callback_data: "axon_sessions:0",
    },
  ]);
  return { inline_keyboard: rows };
}

function getSessionsPageKeyboard(page = 0) {
  const pageSize = 8;
  cachedSessionList = listRecentPiSessions(32);
  const start = page * pageSize;
  const slice = cachedSessionList.slice(start, start + pageSize);

  const rows = slice.map((s, idx) => [
    {
      text: `${s.nodeId === telegramActiveNode ? "[AKTIF] " : ""}${s.label} (${s.sizeKb}KB)`,
      callback_data: `axon_sess_idx:${start + idx}`,
    },
  ]);

  const nav = [];
  if (page > 0) nav.push({ text: "< Prev", callback_data: `axon_sessions:${page - 1}` });
  nav.push({ text: "Workspaces", callback_data: "axon_workspaces" });
  if (start + pageSize < cachedSessionList.length) {
    nav.push({ text: "Next >", callback_data: `axon_sessions:${page + 1}` });
  }
  rows.push(nav);
  return { inline_keyboard: rows };
}

function tgDownloadFileBase64(fileId) {
  return new Promise(async (resolve) => {
    try {
      const info = await tgCurlJson("getFile", { file_id: fileId }, 15);
      const filePath = info?.result?.file_path;
      if (!filePath) return resolve(null);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
      const cp = spawn("curl", ["-4", "-s", "--http1.1", "-m", "20", fileUrl]);
      const chunks = [];
      cp.stdout.on("data", (d) => chunks.push(d));
      cp.on("close", (code) => {
        if (code !== 0) return resolve(null);
        const buf = Buffer.concat(chunks);
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        resolve({ type: "image", mimeType: mime, data: buf.toString("base64") });
      });
      cp.on("error", () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

function getTelegramOwnerChatId() {
  try {
    if (fs.existsSync(TELEGRAM_OWNER_FILE)) {
      const data = JSON.parse(fs.readFileSync(TELEGRAM_OWNER_FILE, "utf8"));
      if (data && data.chatId) return Number(data.chatId);
    }
  } catch {}
  return null;
}

function tgCurlJson(method, body = {}, timeoutSec = 35) {
  return new Promise((resolve) => {
    const cp = spawn("curl", [
      "-4",
      "-s",
      "--http1.1",
      "-m",
      String(timeoutSec),
      "-X",
      "POST",
      `${TELEGRAM_API}/${method}`,
      "-H",
      "Content-Type: application/json",
      "-d",
      "@-",
    ]);
    let stdout = "";
    cp.stdout.on("data", (d) => (stdout += d));
    cp.on("close", () => {
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(null);
      }
    });
    cp.on("error", () => resolve(null));
    try {
      cp.stdin.write(JSON.stringify(body));
      cp.stdin.end();
    } catch {
      resolve(null);
    }
  });
}

async function tgSendText(chatId, text, replyMarkup = null) {
  const clean = String(text || "(Tidak ada respon teks)").trim();
  const maxLen = 3900;
  for (let i = 0; i < clean.length; i += maxLen) {
    const chunk = clean.slice(i, i + maxLen);
    const payload = { chat_id: chatId, text: chunk };
    if (replyMarkup && i + maxLen >= clean.length) {
      payload.reply_markup = replyMarkup;
    }
    await tgCurlJson("sendMessage", payload, 20);
  }
}

function broadcastEvent(type, data) {
  const payload = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function findSessionFile(lookupId) {
  if (!lookupId || !fs.existsSync(SESSIONS_DIR)) return null;
  const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".jsonl"));

  // Direct filename or UUID match
  let match = files.find((f) => f === lookupId || f.includes(lookupId));
  if (match) return path.join(SESSIONS_DIR, match);

  // Fallback by role/name prefix in session_info
  const cleanName = lookupId.toLowerCase();
  for (const f of files.slice().reverse()) {
    try {
      const head = fs.readFileSync(path.join(SESSIONS_DIR, f), "utf-8").slice(0, 1200);
      if (head.toLowerCase().includes(cleanName)) {
        return path.join(SESSIONS_DIR, f);
      }
    } catch {
      // skip unreadable
    }
  }
  return null;
}

function parseSessionHistory(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const messages = [];
  const toolCallById = new Map();

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === "message" && obj.message) {
        const role = obj.message.role;

        // Attach toolResult output back onto its matching toolCall block
        if (role === "toolResult") {
          const callId = obj.message.toolCallId;
          const targetTool = callId ? toolCallById.get(callId) : null;
          if (targetTool) {
            let outText = "";
            if (typeof obj.message.content === "string") {
              outText = obj.message.content;
            } else if (Array.isArray(obj.message.content)) {
              outText = obj.message.content
                .filter((b) => b.type === "text" && b.text)
                .map((b) => b.text)
                .join("\n");
            }
            if (outText) {
              targetTool.output = outText.length > 2500 ? outText.slice(0, 2500) + "\n... [truncated]" : outText;
            }
            if (obj.message.isError) targetTool.isError = true;
          }
          continue;
        }

        if (role !== "user" && role !== "assistant") continue;

        let textContent = "";
        const tools = [];

        if (typeof obj.message.content === "string") {
          textContent = obj.message.content;
        } else if (Array.isArray(obj.message.content)) {
          for (const block of obj.message.content) {
            if (block.type === "text" && block.text) {
              textContent += (textContent ? "\n" : "") + block.text;
            } else if (block.type === "toolCall") {
              const tObj = {
                type: "toolCall",
                id: block.id,
                name: block.name || "tool",
                args: block.arguments || block.args || {},
              };
              tools.push(tObj);
              if (block.id) toolCallById.set(block.id, tObj);
            }
          }
        }

        if (textContent.trim() || tools.length > 0) {
          messages.push({
            id: obj.id || `msg-${messages.length}`,
            role,
            text: textContent.trim(),
            tools: tools.length > 0 ? tools : undefined,
            timestamp: obj.message.timestamp || Date.now(),
            model: obj.message.model,
          });
        }
      } else if (obj.type === "compaction") {
        messages.push({
          id: obj.id || `compact-${messages.length}`,
          role: "system_notice",
          text: `Memory compacted (${obj.tokensBefore ? Math.round(obj.tokensBefore / 1000) + "k tokens" : "auto-pruned"})`,
          timestamp: Date.now(),
        });
      }
    } catch {
      // ignore malformed line
    }
  }
  return messages;
}

async function getOrCreateSession(nodeId, cwd, sessionLookupId) {
  if (activeSessions.has(nodeId)) {
    return activeSessions.get(nodeId);
  }

  const safeCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
  const existingFile = findSessionFile(sessionLookupId || nodeId);

  console.log(
    `[Pi Bridge] Spawning native Pi session for [${nodeId}] in: ${safeCwd}` +
      (existingFile ? ` (resuming ${path.basename(existingFile)})` : " (fresh session)")
  );

  let services = servicesCache.get(safeCwd);
  if (!services) {
    services = await createAgentSessionServices({ cwd: safeCwd });
    servicesCache.set(safeCwd, services);
  }
  const opts = { services };
  if (existingFile) {
    try {
      opts.sessionManager = SessionManager.open(existingFile);
    } catch (e) {
      console.warn(`[Pi Bridge] Could not open session ${existingFile}, starting fresh:`, e.message);
    }
  }

  const { session } = await createAgentSessionFromServices(opts);
  console.log(
    `[Pi Bridge] Session [${nodeId}] ready with model: ${session.model?.provider}/${session.model?.id}`
  );

  const resolvedSessionFile = existingFile ? path.basename(existingFile) : (sessionLookupId || nodeId);
  const meta = { nodeId, sessionFile: resolvedSessionFile, cwd: safeCwd };

  session.subscribe((event) => {
    const rt = nodeRuntimeState.get(nodeId) || {
      isRunning: false,
      phase: "idle",
      activeTool: "",
      activeToolDetail: "",
      liveText: "",
      liveTools: [],
      sessionFile: resolvedSessionFile,
      cwd: safeCwd,
    };

    if (event.type === "message_update") {
      const assistantEvent = event.assistantMessageEvent;
      if (assistantEvent && assistantEvent.type === "text_delta") {
        rt.isRunning = true;
        rt.phase = "streaming";
        rt.liveText += assistantEvent.delta || "";
        nodeRuntimeState.set(nodeId, rt);
        broadcastEvent("text_delta", {
          ...meta,
          delta: assistantEvent.delta,
        });
        const pending = telegramPendingReplies.get(nodeId);
        if (pending) {
          pending.buffer += assistantEvent.delta || "";
        }
      } else if (assistantEvent && assistantEvent.type === "thinking_delta") {
        rt.isRunning = true;
        rt.phase = "thinking";
        nodeRuntimeState.set(nodeId, rt);
        broadcastEvent("thinking_delta", {
          ...meta,
          delta: assistantEvent.delta,
        });
      }
    } else if (event.type === "message_end") {
      if (event.message && event.message.stopReason === "error") {
        const errMsg = event.message.errorMessage || "Model returned an error";
        console.error(`[Pi Bridge] [${nodeId}] Model error:`, errMsg);
        rt.isRunning = false;
        rt.phase = "idle";
        rt.activeTool = "";
        rt.activeToolDetail = "";
        nodeRuntimeState.set(nodeId, rt);
        broadcastEvent("agent_error", {
          ...meta,
          error: errMsg,
        });
        const pending = telegramPendingReplies.get(nodeId);
        if (pending) {
          telegramPendingReplies.delete(nodeId);
          tgSendText(pending.chatId, `[Axon • ${nodeId}] Error:\n${errMsg}`).catch(() => {});
        }
      }
    } else if (event.type === "tool_execution_start") {
      const detail =
        event.args?.command ||
        event.args?.path ||
        event.args?.query ||
        (event.args ? JSON.stringify(event.args).slice(0, 90) : "");
      rt.isRunning = true;
      rt.phase = "tool";
      rt.activeTool = event.toolName || "tool";
      rt.activeToolDetail = String(detail).slice(0, 110);
      rt.liveTools.push({ type: "call", name: event.toolName, args: event.args });
      nodeRuntimeState.set(nodeId, rt);
      broadcastEvent("tool_start", {
        ...meta,
        tool: event.toolName,
        args: event.args,
      });
    } else if (event.type === "tool_execution_end") {
      let outText = "";
      if (typeof event.result === "string") {
        outText = event.result;
      } else if (event.result && Array.isArray(event.result.content)) {
        outText = event.result.content
          .filter((b) => b.type === "text" && b.text)
          .map((b) => b.text)
          .join("\n");
      } else if (event.result && typeof event.result.text === "string") {
        outText = event.result.text;
      }
      const trimmedOut = outText.length > 2500 ? outText.slice(0, 2500) + "\n... [truncated]" : outText;

      if (rt.liveTools.length > 0) {
        rt.liveTools[rt.liveTools.length - 1].isError = event.isError;
        if (trimmedOut) rt.liveTools[rt.liveTools.length - 1].output = trimmedOut;
      }
      nodeRuntimeState.set(nodeId, rt);
      broadcastEvent("tool_end", {
        ...meta,
        tool: event.toolName,
        isError: event.isError,
        output: trimmedOut,
      });
    } else if (event.type === "agent_start") {
      nodeRuntimeState.set(nodeId, {
        isRunning: true,
        phase: "working",
        activeTool: "",
        activeToolDetail: "",
        liveText: "",
        liveTools: [],
        sessionFile: resolvedSessionFile,
        cwd: safeCwd,
        startedAt: Date.now(),
      });
      broadcastEvent("agent_start", {
        ...meta,
        model: session.model ? `${session.model.provider}/${session.model.id}` : undefined,
      });
    } else if (event.type === "agent_end") {
      nodeRuntimeState.set(nodeId, {
        isRunning: false,
        phase: "idle",
        activeTool: "",
        activeToolDetail: "",
        liveText: "",
        liveTools: [],
        sessionFile: resolvedSessionFile,
        cwd: safeCwd,
      });
      const usage = session.messages[session.messages.length - 1]?.usage || {};
      broadcastEvent("agent_end", {
        ...meta,
        usage,
      });
      const pending = telegramPendingReplies.get(nodeId);
      if (pending) {
        telegramPendingReplies.delete(nodeId);
        const replyText = pending.buffer.trim() || "(Selesai tanpa teks output)";
        const header = `[Axon • ${pending.label || nodeId}]\nPath: ${pending.cwd || "-"}\n\n`;
        tgSendText(pending.chatId, header + replyText).catch(() => {});
      }
    }
  });

  const entry = { session, services };
  activeSessions.set(nodeId, entry);
  return entry;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const SESSION_INDEX_CACHE_FILE = "/tmp/axon-session-index.json";
const sessionMetaCache = new Map(); // fileName -> { mtimeMs, size, name, category, cwd, updatedAt, skills }

try {
  if (fs.existsSync(SESSION_INDEX_CACHE_FILE)) {
    const saved = JSON.parse(fs.readFileSync(SESSION_INDEX_CACHE_FILE, "utf-8"));
    for (const [k, v] of Object.entries(saved)) {
      sessionMetaCache.set(k, v);
    }
  }
} catch {
  // ignore corrupt cache
}

let saveCacheTimer = null;
function scheduleSaveSessionCache() {
  if (saveCacheTimer) return;
  saveCacheTimer = setTimeout(() => {
    saveCacheTimer = null;
    try {
      fs.writeFileSync(SESSION_INDEX_CACHE_FILE, JSON.stringify(Object.fromEntries(sessionMetaCache)), "utf-8");
    } catch {
      // ignore
    }
  }, 500);
}

function readHeadAndTail(fullPath, size, chunkBytes = 65536) {
  const fd = fs.openSync(fullPath, "r");
  try {
    const headLen = Math.min(size, chunkBytes);
    const headBuf = Buffer.alloc(headLen);
    fs.readSync(fd, headBuf, 0, headLen, 0);
    const headStr = headBuf.toString("utf-8");

    let tailStr = "";
    if (size > chunkBytes) {
      const tailLen = Math.min(size, chunkBytes);
      const tailBuf = Buffer.alloc(tailLen);
      fs.readSync(fd, tailBuf, 0, tailLen, size - tailLen);
      tailStr = tailBuf.toString("utf-8");
    }
    return { headStr, tailStr };
  } finally {
    fs.closeSync(fd);
  }
}

function extractSessionMeta(fullPath, fileName, stat) {
  const cached = sessionMetaCache.get(fileName);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached;
  }

  let name = "";
  let category = "Global / Home";
  let cwd = "/home/fidel";
  let firstUserText = "";
  let lastActivityMs = 0;
  let skills = null;
  let tokens = 0;

  try {
    // Fast 64KB head + 64KB tail read (never blocks event loop reading 177MB+ files over WSL2 9P!)
    const { headStr, tailStr } = readHeadAndTail(fullPath, stat.size, 65536);

    // 1. Parse first line for cwd/category & fallback header timestamp
    const firstNl = headStr.indexOf("\n");
    const firstLine = firstNl === -1 ? headStr : headStr.slice(0, firstNl);
    if (firstLine.trim().startsWith("{")) {
      try {
        const hdr = JSON.parse(firstLine);
        if (hdr.timestamp) {
          const parsed = typeof hdr.timestamp === "number" ? hdr.timestamp : Date.parse(hdr.timestamp);
          if (!Number.isNaN(parsed)) lastActivityMs = parsed;
        }
        if (hdr.type === "session" && hdr.cwd) {
          const c = String(hdr.cwd);
          cwd = c;
          if (c.includes("halohanzi-part1")) category = "HaloHanzi Part 1";
          else if (c.includes("halohanzi-part2")) category = "HaloHanzi Part 2";
          else if (c.includes("halohanzi-assets")) category = "HaloHanzi Assets";
          else if (c.includes("matcha-showcase")) category = "Matcha Showcase";
          else if (c.includes("/axon")) category = "Axon Studio";
          else if (c.includes("ChineseLearning")) category = "ChineseLearning";
          else if (c === "/home/fidel" || c.endsWith("/fidel")) category = "Global / Home";
          else category = path.basename(c) || "Global / Home";
        }
      } catch {
        // ignore
      }
    }

    // 1b. Read real last activity timestamp from the last non-empty JSONL line
    const tailSource = (tailStr || headStr).trimEnd();
    const lastNl = tailSource.lastIndexOf("\n");
    const lastLine = lastNl === -1 ? tailSource : tailSource.slice(lastNl + 1);
    if (lastLine.trim().startsWith("{")) {
      try {
        const tailObj = JSON.parse(lastLine);
        const tsVal = tailObj.timestamp || tailObj.message?.timestamp;
        if (tsVal) {
          const parsed = typeof tsVal === "number" ? tsVal : Date.parse(tsVal);
          if (!Number.isNaN(parsed) && parsed > 0) lastActivityMs = parsed;
        }
      } catch {
        // ignore
      }
    }

    const findLatestJsonObj = (buf, marker) => {
      if (!buf) return null;
      const idx = buf.lastIndexOf(marker);
      if (idx === -1) return null;
      const lineStart = buf.lastIndexOf("\n", idx) + 1;
      let lineEnd = buf.indexOf("\n", idx);
      if (lineEnd === -1) lineEnd = buf.length;
      try {
        return JSON.parse(buf.slice(lineStart, lineEnd));
      } catch {
        return null;
      }
    };

    // 2. Find the LATEST `"type":"session_info"` entry:
    //    Check tail (64KB) -> head (64KB) -> if still missing & not cached, use ultra-fast native C `grep -a` (scans 50MB in ~15ms with 0 JS heap!)
    const infoObj =
      findLatestJsonObj(tailStr, '"type":"session_info"') ||
      findLatestJsonObj(headStr, '"type":"session_info"');
    if (infoObj && infoObj.name) {
      name = String(infoObj.name).trim();
    } else if (cached && cached.name && !cached.name.startsWith("2026-")) {
      name = cached.name;
    } else if (stat.size > 131072) {
      try {
        const grepOut = execFileSync("grep", ["-a", '"type":"session_info"', fullPath], {
          encoding: "utf-8",
          maxBuffer: 2 * 1024 * 1024,
        }).trim();
        if (grepOut) {
          const lastMatch = grepOut.split("\n").pop();
          const parsedInfo = JSON.parse(lastMatch);
          if (parsedInfo && parsedInfo.name) {
            name = String(parsedInfo.name).trim();
          }
        }
      } catch {
        // grep returns exit code 1 when no session_info exists in file
      }
    }

    // 2b. Find latest persisted `"type":"axon_skills"` entry in tail, then head
    const skillObj =
      findLatestJsonObj(tailStr, '"type":"axon_skills"') ||
      findLatestJsonObj(headStr, '"type":"axon_skills"');
    if (skillObj && Array.isArray(skillObj.skills)) {
      skills = skillObj.skills;
    }

    // 2c. Extract real latest context token usage from tail (or head)
    const usageSource = tailStr || headStr;
    const usageIdx = usageSource.lastIndexOf('"totalTokens":');
    if (usageIdx !== -1) {
      const mTok = usageSource.slice(usageIdx, usageIdx + 40).match(/"totalTokens"\s*:\s*(\d+)/);
      if (mTok) tokens = parseInt(mTok[1], 10) || 0;
    }
    if (!tokens) {
      const inIdx = usageSource.lastIndexOf('"input":');
      if (inIdx !== -1) {
        const slice = usageSource.slice(inIdx, inIdx + 120);
        const mIn = slice.match(/"input"\s*:\s*(\d+)/);
        const mCache = slice.match(/"cacheRead"\s*:\s*(\d+)/);
        const mOut = slice.match(/"output"\s*:\s*(\d+)/);
        tokens =
          (mIn ? parseInt(mIn[1], 10) : 0) +
          (mCache ? parseInt(mCache[1], 10) : 0) +
          (mOut ? parseInt(mOut[1], 10) : 0);
      }
    }

    // 3. Fallback to first user text message in head if no session_info name exists
    if (!name) {
      for (const line of headStr.split("\n")) {
        if (!line.includes('"role":"user"') && !line.includes('"role": "user"')) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === "message" && obj.message?.role === "user") {
            if (typeof obj.message.content === "string") {
              firstUserText = obj.message.content.trim();
            } else if (Array.isArray(obj.message.content)) {
              const tb = obj.message.content.find((b) => b.type === "text" && b.text);
              if (tb) firstUserText = String(tb.text).trim();
            }
            if (firstUserText) break;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore unreadable file
  }

  const displayName =
    name ||
    (cached && cached.name) ||
    (firstUserText
      ? firstUserText.replace(/\/tmp\/pi-clipboard-\S+\s*/g, "").replace(/\s+/g, " ").trim().slice(0, 48)
      : "") ||
    fileName.replace(".jsonl", "");

  const meta = {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    name: displayName,
    category,
    cwd,
    skills: skills || (cached && cached.skills) || null,
    tokens: tokens || (cached && cached.tokens) || 0,
    updatedAt: lastActivityMs || stat.mtimeMs,
  };
  sessionMetaCache.set(fileName, meta);
  scheduleSaveSessionCache();
  return meta;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // 1. Live SSE Stream
  if (url.pathname === "/api/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  // 2a. Discord Rich Presence State (GET / POST — 0 LLM tokens)
  if (url.pathname === "/api/presence" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(discordPresenceState));
    return;
  }

  if (url.pathname === "/api/presence" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      discordPresenceState = {
        active: Boolean(body.active),
        sessionName: String(body.sessionName || "").slice(0, 80),
        category: String(body.category || "Standby").slice(0, 64),
        updatedAt: Date.now(),
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, presence: discordPresenceState }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. Health check
  if (url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "online",
        activeSessions: activeSessions.size,
        sessionsDir: SESSIONS_DIR,
        telegram: {
          online: telegramOnline,
          activeNode: telegramActiveNode,
          ownerChatId: getTelegramOwnerChatId(),
          lastPollAt: telegramLastPollAt,
        },
      })
    );
    return;
  }

  // 2b. Live Pi Sessions Catalog (reads ~/.pi/agent/sessions/--home-fidel--/*.jsonl directly)
  if (url.pathname === "/api/sessions" && req.method === "GET") {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ sessions: [] }));
        return;
      }

      const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".jsonl"));
      const list = [];

      for (const fileName of files) {
        try {
          const fullPath = path.join(SESSIONS_DIR, fileName);
          const stat = fs.statSync(fullPath);
          const meta = extractSessionMeta(fullPath, fileName, stat);
          list.push({
            id: fileName.replace(/\.jsonl$/, ""),
            fileName,
            name: meta.name,
            category: meta.category,
            cwd: meta.cwd,
            skills: meta.skills,
            role: "",
            tokens: meta.tokens || 0,
            size: stat.size,
            updatedAt: meta.updatedAt,
          });
        } catch {
          // skip unreadable file
        }
      }

      list.sort((a, b) => b.updatedAt - a.updatedAt);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ sessions: list }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message, sessions: [] }));
    }
    return;
  }

  // 2c. Permanently Create New Real Pi Session (.jsonl)
  if (url.pathname === "/api/sessions/create" && req.method === "POST") {
    try {
      const { name, cwd } = await readJsonBody(req);
      if (!name || !String(name).trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Session name is required" }));
        return;
      }
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      const now = new Date();
      const isoSafe = now.toISOString().replace(/[:.]/g, "-");
      const randId = Math.random().toString(16).slice(2, 10) + "-" + Date.now().toString(16);
      const fileName = `${isoSafe}_${randId}.jsonl`;
      const fullPath = path.join(SESSIONS_DIR, fileName);
      const rawCwd = cwd ? String(cwd).trim() : "";
      const sessionCwd = rawCwd ? normalizeUserPath(rawCwd) : "/mnt/c/Users/Pongo";

      const headerLine = JSON.stringify({
        type: "session",
        version: 3,
        id: randId,
        timestamp: now.toISOString(),
        cwd: sessionCwd,
      });
      const infoLine = JSON.stringify({
        type: "session_info",
        id: `info-${Date.now().toString(16)}`,
        timestamp: now.toISOString(),
        name: String(name).trim(),
      });

      fs.writeFileSync(fullPath, `${headerLine}\n${infoLine}\n`, "utf-8");
      console.log(`[Pi Bridge] Created real Pi session: ${fileName} ("${name.trim()}")`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          session: {
            id: fileName.replace(/\.jsonl$/, ""),
            fileName,
            name: String(name).trim(),
            category: path.basename(sessionCwd) || "Global / Home",
            role: "",
            tokens: 0,
            size: fs.statSync(fullPath).size,
            updatedAt: Date.now(),
          },
        })
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 2d. Permanently Rename Real Pi Session (.jsonl)
  if (url.pathname === "/api/sessions/rename" && req.method === "POST") {
    try {
      const { fileName, id, name } = await readJsonBody(req);
      if (!name || !String(name).trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "New name is required" }));
        return;
      }
      const safeBase = path.basename(String(fileName || `${id}.jsonl`));
      const targetPath = safeBase.endsWith(".jsonl")
        ? path.join(SESSIONS_DIR, safeBase)
        : findSessionFile(id || safeBase);

      if (!targetPath || !fs.existsSync(targetPath) || !path.resolve(targetPath).startsWith(path.resolve(SESSIONS_DIR))) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Session file not found on disk" }));
        return;
      }

      const infoLine = JSON.stringify({
        type: "session_info",
        id: `rename-${Date.now().toString(16)}`,
        timestamp: new Date().toISOString(),
        name: String(name).trim(),
      });
      fs.appendFileSync(targetPath, `\n${infoLine}\n`, "utf-8");
      console.log(`[Pi Bridge] Renamed Pi session ${path.basename(targetPath)} -> "${name.trim()}"`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, fileName: path.basename(targetPath), name: String(name).trim() }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 2e. Permanently Delete Real Pi Session (.jsonl)
  if (url.pathname === "/api/sessions/delete" && req.method === "POST") {
    try {
      const { fileName, id } = await readJsonBody(req);
      const safeBase = path.basename(String(fileName || `${id}.jsonl`));
      const targetPath = safeBase.endsWith(".jsonl")
        ? path.join(SESSIONS_DIR, safeBase)
        : findSessionFile(id || safeBase);

      if (!targetPath || !fs.existsSync(targetPath) || !path.resolve(targetPath).startsWith(path.resolve(SESSIONS_DIR))) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Session file not found on disk" }));
        return;
      }

      fs.unlinkSync(targetPath);
      const baseId = path.basename(targetPath, ".jsonl");
      for (const [k] of activeSessions.entries()) {
        if (k.includes(baseId) || baseId.includes(k)) {
          activeSessions.delete(k);
        }
      }
      console.log(`[Pi Bridge] Permanently deleted Pi session file: ${path.basename(targetPath)}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, deletedFile: path.basename(targetPath) }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 2f. Permanently Inject Skills (clones github:owner/repo into Pi skills dir & persists to .jsonl)
  if (url.pathname === "/api/skills/inject" && req.method === "POST") {
    try {
      const { sessionId, fileName, skills } = await readJsonBody(req);
      if (!Array.isArray(skills)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "skills array is required" }));
        return;
      }

      const SKILLS_DIR = "/home/fidel/.pi/agent/skills";
      fs.mkdirSync(SKILLS_DIR, { recursive: true });

      const installedGitHub = [];
      for (const sk of skills) {
        const s = String(sk).trim();
        if (!s.startsWith("github:")) continue;
        const repoSlug = s.replace(/^github:/, "");
        const parts = repoSlug.split("/").filter(Boolean);
        if (parts.length < 2) continue;
        const owner = parts[0].replace(/[^a-zA-Z0-9._-]/g, "");
        const repo = parts[1].replace(/[^a-zA-Z0-9._-]/g, "");
        const destDir = path.join(SKILLS_DIR, repo);

        if (!fs.existsSync(destDir)) {
          await new Promise((resolve) => {
            execFile(
              "git",
              ["clone", "--depth", "1", `https://github.com/${owner}/${repo}.git`, destDir],
              { timeout: 30000 },
              (err) => {
                if (err) console.warn(`[Pi Bridge] GitHub skill clone warning (${owner}/${repo}):`, err.message);
                resolve();
              }
            );
          });
        }

        // Ensure SKILL.md exists at root of cloned repo so Pi natively registers /skill:<repo>
        const skillMd = path.join(destDir, "SKILL.md");
        if (fs.existsSync(destDir) && !fs.existsSync(skillMd)) {
          const readmePath = path.join(destDir, "README.md");
          const readmeHint = fs.existsSync(readmePath)
            ? `Read \`${readmePath}\` for full guidelines and patterns from \`${owner}/${repo}\`.`
            : `Cloned GitHub skill repository \`${owner}/${repo}\` installed at \`${destDir}\`.`;
          fs.writeFileSync(
            skillMd,
            `---\nname: ${repo}\ndescription: GitHub skill imported from ${owner}/${repo} via Axon Studio.\n---\n\n# ${repo} (${owner}/${repo})\n\n${readmeHint}\n`,
            "utf-8"
          );
        }
        installedGitHub.push(`${owner}/${repo}`);
      }

      // Persist session skill list directly inside the real Pi .jsonl file
      let persistedFile = null;
      const lookup = fileName || sessionId;
      if (lookup) {
        const targetPath = findSessionFile(String(lookup));
        if (targetPath && fs.existsSync(targetPath)) {
          const entryLine = JSON.stringify({
            type: "axon_skills",
            id: `skills-${Date.now().toString(16)}`,
            timestamp: new Date().toISOString(),
            skills,
          });
          fs.appendFileSync(targetPath, `\n${entryLine}\n`, "utf-8");
          persistedFile = path.basename(targetPath);
          sessionMetaCache.delete(persistedFile);
        }
      }

      console.log(
        `[Pi Bridge] Persisted ${skills.length} skill(s) to ${persistedFile || "(ui-only)"}` +
          (installedGitHub.length ? ` | GitHub cloned: ${installedGitHub.join(", ")}` : "")
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          persistedFile,
          installedGitHub,
          skills,
        })
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 3. Real Pi Session History (.jsonl) Reader + Live Background Runtime State
  if (url.pathname === "/api/session-history" && req.method === "GET") {
    try {
      const lookupId = url.searchParams.get("id") || "";
      const nodeIdParam = url.searchParams.get("nodeId") || "";
      const filePath = findSessionFile(lookupId);
      const baseFile = filePath ? path.basename(filePath) : "";

      // Find any active background runtime state for this node or session file
      let runtimeState = nodeRuntimeState.get(nodeIdParam) || null;
      if (!runtimeState && (lookupId || baseFile)) {
        for (const [, st] of nodeRuntimeState.entries()) {
          if (
            (baseFile && st.sessionFile === baseFile) ||
            (lookupId && st.sessionFile && st.sessionFile.includes(lookupId))
          ) {
            runtimeState = st;
            break;
          }
        }
      }

      if (!filePath) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ found: false, messages: [], runtimeState }));
        return;
      }
      const messages = parseSessionHistory(filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          found: true,
          file: baseFile,
          totalMessages: messages.length,
          messages,
          runtimeState,
        })
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ found: false, error: err.message, messages: [] }));
    }
    return;
  }

  // 4. Dispatch Multimodal Prompt to Live Pi Engine
  if (url.pathname === "/api/prompt" && req.method === "POST") {
    try {
      const { nodeId, cwd, prompt, sessionId, images, thinkingLevel } = await readJsonBody(req);
      if ((!prompt || !prompt.trim()) && (!images || images.length === 0)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Prompt or image is required" }));
        return;
      }

      const targetNode = nodeId || "hub-main";
      const { session, services } = await getOrCreateSession(targetNode, cwd, sessionId);

      if (thinkingLevel && typeof session.setThinkingLevel === "function") {
        try {
          session.setThinkingLevel(thinkingLevel);
        } catch {
          // ignore if unsupported by model
        }
      }

      // Optional model override if requested from UI
      if (req.url && services?.modelRuntime?.models) {
        // Keep session's antigravity default unless explicitly switched
      }

      const formattedImages = Array.isArray(images)
        ? images
            .slice(0, 10)
            .map((dataUrl) => {
              const m = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
              if (!m) return null;
              return { type: "image", mimeType: m[1], data: m[2] };
            })
            .filter(Boolean)
        : [];

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          accepted: true,
          nodeId: targetNode,
          model: session.model ? `${session.model.provider}/${session.model.id}` : undefined,
        })
      );

      const promptOpts = formattedImages.length > 0 ? { images: formattedImages } : undefined;
      session
        .prompt((prompt || "Analyze the attached image(s).").trim(), promptOpts)
        .catch((err) => {
          console.error(`[Pi Bridge] [${targetNode}] Prompt failed:`, err);
          broadcastEvent("agent_error", { nodeId: targetNode, error: err.message });
        });
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2g. Live Local Skills Catalog (reads ~/.pi/agent/skills -> C:\Users\Pongo\Axon-Studio\pi-data\skills)
  if (url.pathname === "/api/skills/list" && req.method === "GET") {
    try {
      const skillsDir = "/home/fidel/.pi/agent/skills";
      const result = [];
      if (fs.existsSync(skillsDir)) {
        const dirs = fs.readdirSync(skillsDir, { withFileTypes: true });
        for (const d of dirs) {
          if (!d.isDirectory() && !d.isSymbolicLink()) continue;
          const skillMd = path.join(skillsDir, d.name, "SKILL.md");
          let description = `Installed skill (${d.name})`;
          let displayName = d.name;
          if (fs.existsSync(skillMd)) {
            try {
              const content = fs.readFileSync(skillMd, "utf-8").slice(0, 1200);
              const descMatch = content.match(/^description:\s*(.+)$/m);
              if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, "");
              const nameMatch = content.match(/^name:\s*(.+)$/m);
              if (nameMatch) displayName = nameMatch[1].trim().replace(/^["']|["']$/g, "");
            } catch {
              // ignore
            }
          }
          result.push({
            id: d.name,
            name: displayName,
            description,
            category: "system",
          });
        }
      }
      result.sort((a, b) => a.id.localeCompare(b.id));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ skills: result }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message, skills: [] }));
    }
    return;
  }

  // 2h. Real Git Worktree List for Canvas Topology Sync
  if (url.pathname === "/api/worktrees" && req.method === "GET") {
    try {
      const repoPath = url.searchParams.get("repoPath") || "";
      if (!repoPath || !fs.existsSync(repoPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ worktrees: [] }));
        return;
      }
      execFile("git", ["-C", repoPath, "worktree", "list", "--porcelain"], (err, stdout) => {
        if (err || !stdout) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ worktrees: [] }));
          return;
        }
        const blocks = stdout.trim().split(/\n\n+/);
        const worktrees = [];
        blocks.forEach((blk, idx) => {
          const wtMatch = blk.match(/^worktree\s+(.+)$/m);
          const brMatch = blk.match(/^branch\s+refs\/heads\/(.+)$/m);
          if (wtMatch) {
            const wtPath = wtMatch[1].trim();
            const branch = brMatch ? brMatch[1].trim() : path.basename(wtPath);
            worktrees.push({
              path: wtPath,
              branch,
              isMain: idx === 0,
            });
          }
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ worktrees }));
      });
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message, worktrees: [] }));
    }
    return;
  }

  // 5. Compact Session Memory (Real Pi PTY /compact OR real Pi SDK session.compact())
  if (url.pathname === "/api/compact" && req.method === "POST") {
    try {
      const { nodeId, sessionId, cwd } = await readJsonBody(req);
      let method = "none";

      // 1. If Native Pi PTY is open for this node, send real `/compact` straight to Pi CLI!
      if (nodeId && sendInputToPty(nodeId, "/compact\r")) {
        method = "native_pty";
        console.log(`[Pi Bridge] Sent real /compact to active Native Pi PTY [${nodeId}]`);
      } else if (nodeId || sessionId) {
        // 2. Otherwise open the real Pi session and run session.compact() directly on disk
        const { session } = await getOrCreateSession(nodeId || sessionId, cwd, sessionId || nodeId);
        if (typeof session.compact === "function") {
          await session.compact();
          method = "sdk_compact";
        } else {
          await session.prompt("/compact");
          method = "sdk_prompt";
        }
        console.log(`[Pi Bridge] Real Pi compaction finished for [${nodeId || sessionId}] via ${method}`);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, nodeId, method }));
    } catch (err) {
      console.error("[Pi Bridge] Real compaction failed:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 5b. Force Abort / Cancel Running Agent Turn (Esc Shortcut)
  if (url.pathname === "/api/abort" && req.method === "POST") {
    try {
      const { nodeId } = await readJsonBody(req);
      if (nodeId && activeSessions.has(nodeId)) {
        const { session } = activeSessions.get(nodeId);
        console.log(`[Pi Bridge] Aborting active execution for [${nodeId}]`);
        if (typeof session.abort === "function") {
          await session.abort();
        }
      }
      if (nodeId && nodeRuntimeState.has(nodeId)) {
        const rt = nodeRuntimeState.get(nodeId);
        rt.isRunning = false;
        rt.phase = "idle";
        rt.activeTool = "";
        rt.activeToolDetail = "";
        nodeRuntimeState.set(nodeId, rt);
      }
      broadcastEvent("agent_aborted", { nodeId });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ aborted: true, nodeId }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 6. Real Git Worktree Creation (auto-computes sibling folder & supports new or existing branch)
  if (url.pathname === "/api/worktree" && req.method === "POST") {
    try {
      const { repoPath, branchName, worktreeDir } = await readJsonBody(req);
      if (!repoPath || !branchName) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "repoPath and branchName are required" }));
        return;
      }

      const cleanBranch = String(branchName).trim().replace(/\s+/g, "-");
      const slug = cleanBranch.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
      const repoBase = path.basename(repoPath);
      const targetDir =
        worktreeDir && String(worktreeDir).trim()
          ? String(worktreeDir).trim()
          : path.join(path.dirname(repoPath), `${repoBase}-${slug || "branch"}`);

      const runGit = (args) =>
        new Promise((resolve, reject) => {
          execFile("git", ["-C", repoPath, ...args], (err, stdout, stderr) => {
            if (err) reject(new Error((stderr || err.message || "").trim()));
            else resolve((stdout || "").trim());
          });
        });

      // Check if branch already exists locally
      let branchExists = false;
      try {
        await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${cleanBranch}`]);
        branchExists = true;
      } catch {
        branchExists = false;
      }

      const addArgs = branchExists
        ? ["worktree", "add", targetDir, cleanBranch]
        : ["worktree", "add", "-b", cleanBranch, targetDir];

      const stdout = await runGit(addArgs);
      console.log(`[Pi Bridge] Git worktree created: ${cleanBranch} -> ${targetDir}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          branchName: cleanBranch,
          worktreeDir: targetDir,
          stdout,
        })
      );
    } catch (err) {
      console.error("[Pi Bridge] Git worktree add failed:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 6b. Real Git Worktree & Branch Deletion
  if (url.pathname === "/api/worktree/remove" && req.method === "POST") {
    try {
      const { repoPath, branchName, worktreeDir } = await readJsonBody(req);
      if (!repoPath || !branchName) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "repoPath and branchName are required" }));
        return;
      }

      const cleanBranch = String(branchName).trim();
      if (["main", "master"].includes(cleanBranch.toLowerCase())) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Protected branch (main/master) cannot be deleted" }));
        return;
      }

      const runGit = (args) =>
        new Promise((resolve, reject) => {
          execFile("git", ["-C", repoPath, ...args], (err, stdout, stderr) => {
            if (err) reject(new Error((stderr || err.message || "").trim()));
            else resolve((stdout || "").trim());
          });
        });

      // Locate matching worktree path from `git worktree list --porcelain`
      let targetDir = worktreeDir || "";
      try {
        const listOut = await runGit(["worktree", "list", "--porcelain"]);
        const blocks = listOut.split(/\n\n+/);
        for (const blk of blocks) {
          const wtMatch = blk.match(/^worktree\s+(.+)$/m);
          const brMatch = blk.match(/^branch\s+refs\/heads\/(.+)$/m);
          if (wtMatch && brMatch && brMatch[1].trim() === cleanBranch) {
            targetDir = wtMatch[1].trim();
            break;
          }
        }
      } catch {
        // ignore list failure
      }

      // Safety: never delete the primary repo folder itself
      const normalizedRepo = path.resolve(repoPath);
      let removedDir = null;
      if (targetDir && path.resolve(targetDir) !== normalizedRepo) {
        try {
          await runGit(["worktree", "remove", "--force", targetDir]);
          removedDir = targetDir;
        } catch (wtErr) {
          console.warn("[Pi Bridge] worktree remove warning:", wtErr.message);
        }
      }

      await runGit(["worktree", "prune"]).catch(() => {});

      let removedBranch = false;
      try {
        await runGit(["branch", "-D", cleanBranch]);
        removedBranch = true;
      } catch (brErr) {
        console.warn("[Pi Bridge] branch -D warning:", brErr.message);
      }

      console.log(
        `[Pi Bridge] Git worktree removed: branch=${cleanBranch}, dir=${removedDir || "(none)"}, branchDeleted=${removedBranch}`
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          removedDir,
          removedBranch,
          branchName: cleanBranch,
        })
      );
    } catch (err) {
      console.error("[Pi Bridge] Git worktree remove failed:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 6c. Save pasted/dropped image from xterm.js to /tmp/pi-clipboard-*.png for native Pi auto-image-drop
  if (url.pathname === "/api/pty/upload-image" && req.method === "POST") {
    try {
      const { base64 } = await readJsonBody(req);
      const m = String(base64 || "").match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!m) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid image data URL" }));
        return;
      }
      const ext = m[1].replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "png";
      const filePath = `/tmp/pi-clipboard-${crypto.randomUUID()}.${ext}`;
      fs.writeFileSync(filePath, Buffer.from(m[2], "base64"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, path: filePath }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 6d. Kill / Reset a Native Pi PTY Session
  if (url.pathname === "/api/pty/kill" && req.method === "POST") {
    try {
      const { nodeId } = await readJsonBody(req);
      const killed = killPtySession(nodeId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, killed, activePtys: getActivePtyCount() }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7. Serve built Axon Studio production frontend (/dist) for standalone desktop launch
  const distDir = path.resolve(__dirname, "../dist");
  if (req.method === "GET" && fs.existsSync(distDir)) {
    const reqPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(distDir, safePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, "index.html");
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".json": "application/json",
      ".woff2": "font/woff2",
    };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

setPtyStatusCallback((evt) => {
  broadcastEvent("pty_status", evt);
});

attachPtyWebSocket(server);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Axon Pi Native Bridge] Online at http://127.0.0.1:${PORT} (Native Pi PTY WebSocket: /ws/pty)`);
  startTelegramBridge();
  // Pre-warm Pi services in background so first user prompt has near-zero startup latency
  const warmCwd = "/mnt/c/Users/Pongo/axon";
  if (fs.existsSync(warmCwd) && !servicesCache.has(warmCwd)) {
    createAgentSessionServices({ cwd: warmCwd })
      .then((s) => {
        servicesCache.set(warmCwd, s);
        console.log("[Pi Bridge] Pre-warmed default Pi services (antigravity ready)");
      })
      .catch(() => {});
  }
});

async function dispatchTelegramPrompt(chatId, nodeId, promptText, images = []) {
  const nodeCfg = getActiveNodeConfig(nodeId);
  await tgCurlJson("sendChatAction", { chat_id: chatId, action: "typing" }, 10);

  broadcastEvent("user_message", {
    nodeId,
    sessionFile: nodeCfg.sessionId || nodeId,
    cwd: nodeCfg.cwd,
    text: `[Telegram] ${promptText}`,
    source: "telegram",
    timestamp: Date.now(),
  });

  try {
    const { session } = await getOrCreateSession(nodeId, nodeCfg.cwd, nodeCfg.sessionId);
    telegramPendingReplies.set(nodeId, {
      chatId,
      buffer: "",
      label: nodeCfg.label,
      cwd: nodeCfg.cwd,
    });
    const promptOpts = images.length > 0 ? { images } : undefined;
    session.prompt(promptText, promptOpts).catch((err) => {
      console.error(`[Axon Telegram] Prompt error on [${nodeId}]:`, err);
      telegramPendingReplies.delete(nodeId);
      broadcastEvent("agent_error", { nodeId, error: err.message });
      tgSendText(
        chatId,
        `[Axon • ${nodeCfg.label}]\nPath: ${nodeCfg.cwd}\n\nGagal memproses:\n${err.message}`
      ).catch(() => {});
    });
  } catch (err) {
    telegramPendingReplies.delete(nodeId);
    await tgSendText(
      chatId,
      `[Axon • ${nodeCfg.label}]\nPath: ${nodeCfg.cwd}\n\nError koneksi sesi:\n${err.message}`
    );
  }
}

async function handleTelegramUpdate(update) {
  const ownerChatId = getTelegramOwnerChatId();

  // Handle inline keyboard callbacks (node switch & real Pi session browser)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    if (ownerChatId && Number(chatId) !== ownerChatId) return;

    await tgCurlJson("answerCallbackQuery", { callback_query_id: cb.id }, 10);
    const data = cb.data || "";

    if (data === "axon_workspaces") {
      const cur = getActiveNodeConfig();
      await tgCurlJson("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: `Pilih Workspace / Role Axon:\n\nTarget saat ini: ${cur.label}\nPath: ${cur.cwd}`,
        reply_markup: getNodesKeyboard(),
      }, 15);
      return;
    }

    if (data.startsWith("axon_sessions:")) {
      const page = parseInt(data.split(":")[1] || "0", 10) || 0;
      const cur = getActiveNodeConfig();
      await tgCurlJson("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: `Pilih Sesi Pi Asli (.jsonl) — Halaman ${page + 1}:\n\nTarget saat ini: ${cur.label}\nPath: ${cur.cwd}`,
        reply_markup: getSessionsPageKeyboard(page),
      }, 15);
      return;
    }

    if (data.startsWith("axon_sess_idx:")) {
      const idx = parseInt(data.split(":")[1] || "-1", 10);
      const chosen = cachedSessionList[idx];
      if (chosen) {
        AXON_NODES[chosen.nodeId] = {
          label: chosen.label,
          cwd: chosen.cwd,
          sessionId: chosen.file,
        };
        telegramActiveNode = chosen.nodeId;
        await tgSendText(
          chatId,
          `Target Axon dipindahkan ke Sesi Pi:\n` +
            `Sesi: ${chosen.label}\n` +
            `Path: ${chosen.cwd}\n` +
            `File: ${chosen.file}\n\n` +
            `Semua prompt berikutnya akan dikirim ke sesi & path ini.`
        );
      }
      return;
    }

    if (data.startsWith("axon_node:")) {
      const nextNode = data.replace("axon_node:", "");
      if (AXON_NODES[nextNode]) {
        telegramActiveNode = nextNode;
        const info = AXON_NODES[nextNode];
        await tgSendText(
          chatId,
          `Target Axon dipindahkan ke:\n` +
            `Node: ${info.label} (${nextNode})\n` +
            `Path: ${info.cwd}\n\n` +
            `Semua prompt berikutnya akan dikirim ke path ini.`
        );
      }
    }
    return;
  }

  const msg = update.message;
  if (!msg || !msg.chat) return;
  const chatId = msg.chat.id;

  // Owner security gate
  if (ownerChatId && Number(chatId) !== ownerChatId) {
    console.warn(`[Axon Telegram] Ignored unauthorized chatId: ${chatId}`);
    return;
  }

  const text = (msg.text || msg.caption || "").trim();
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  if (!text && !hasPhoto) return;

  // 1. /start or /help
  if (text === "/start" || text === "/help") {
    const info = getActiveNodeConfig();
    await tgSendText(
      chatId,
      `Jarvis x Axon Studio Bridge AKTIF.\n\n` +
        `Target Aktif: ${info.label}\n` +
        `Path: ${info.cwd}\n\n` +
        `Perintah Tersedia:\n` +
        `/sessions (atau /menu, /nodes, /switch) - Pilih Workspace / Sesi Pi asli\n` +
        `/newsession <path> - Buat sesi baru di folder Windows/WSL tertentu\n` +
        `/status - Cek target aktif, path, dan status Axon Bridge\n` +
        `/abort (atau /stop) - Hentikan paksa eksekusi berjalan (seperti Esc)\n` +
        `/compact - Ringkas memori sesi aktif\n` +
        `/dev1 /dev2 /designer /qa /axon /matcha /hub [prompt] - Pindah atau kirim cepat ke role/project\n\n` +
        `Atau langsung kirim teks/foto apa saja untuk dieksekusi di Path aktif!`,
      getNodesKeyboard()
    );
    return;
  }

  // 2. Session & Workspace Selector (all WezTerm aliases supported)
  if (
    ["/session", "/sessions", "/menu", "/roles", "/switch", "/project", "/projects", "/nodes"].includes(
      text.toLowerCase()
    )
  ) {
    const info = getActiveNodeConfig();
    await tgSendText(
      chatId,
      `Pilih Workspace / Sesi Axon:\n\nTarget saat ini: ${info.label}\nPath: ${info.cwd}`,
      getNodesKeyboard()
    );
    return;
  }

  // 3. /newsession <path> (aliases: /new_session, /newtab, /newproject)
  if (/^\/(newsession|new_session|newtab|newproject)\b/i.test(text)) {
    const arg = text.replace(/^\/(newsession|new_session|newtab|newproject)\s*/i, "").trim();
    if (!arg) {
      await tgSendText(
        chatId,
        `Format: /newsession <path>\nContoh:\n/newsession /mnt/c/Users/Pongo/axon\natau\n/newsession C:\\Users\\Pongo\\matcha-showcase`
      );
      return;
    }
    const targetPath = normalizeUserPath(arg);
    if (!fs.existsSync(targetPath)) {
      await tgSendText(chatId, `Folder tidak ditemukan:\n${targetPath}`);
      return;
    }
    const folderName = path.basename(targetPath) || "custom";
    const newId = `custom-${folderName}-${Date.now().toString(36)}`;
    AXON_NODES[newId] = {
      label: `Custom (${folderName})`,
      cwd: targetPath,
      sessionId: newId,
    };
    telegramActiveNode = newId;
    await tgSendText(
      chatId,
      `Sesi Axon baru siap & aktif:\nNode: Custom (${folderName})\nPath: ${targetPath}\n\nLangsung kirim prompt untuk mulai bekerja di folder ini.`
    );
    return;
  }

  // 4. /status
  if (text === "/status") {
    const info = getActiveNodeConfig();
    await tgSendText(
      chatId,
      `Axon Bridge: ONLINE (port ${PORT})\n` +
        `Target Aktif: ${info.label} (${telegramActiveNode})\n` +
        `Path: ${info.cwd}\n` +
        `Session ID: ${info.sessionId || "-"}\n` +
        `Sesi Pi termuat di RAM: ${activeSessions.size}`
    );
    return;
  }

  // 5. /abort or /stop (Force stop like Esc in Axon)
  if (text === "/abort" || text === "/stop") {
    const nodeId = telegramActiveNode;
    const info = getActiveNodeConfig(nodeId);
    if (activeSessions.has(nodeId)) {
      const { session } = activeSessions.get(nodeId);
      if (typeof session.abort === "function") {
        await session.abort().catch(() => {});
      }
    }
    telegramPendingReplies.delete(nodeId);
    broadcastEvent("agent_aborted", { nodeId });
    await tgSendText(chatId, `[ABORTED] Eksekusi dihentikan paksa.\nTarget: ${info.label}\nPath: ${info.cwd}`);
    return;
  }

  // 6. /compact
  if (text === "/compact") {
    const nodeId = telegramActiveNode;
    const info = getActiveNodeConfig(nodeId);
    if (activeSessions.has(nodeId)) {
      const { session } = activeSessions.get(nodeId);
      if (typeof session.compact === "function") {
        await session.compact().catch(() => {});
      }
    }
    await tgSendText(chatId, `[COMPACT] Memori sesi diringkas.\nTarget: ${info.label}\nPath: ${info.cwd}`);
    return;
  }

  // 7. Quick role/workspace shortcuts: /dev1, /dev2, /designer, /qa, /axon, /matcha, /hub
  const firstWord = text.split(/\s+/)[0].toLowerCase();
  if (ROLE_ALIASES[firstWord]) {
    const targetNodeId = ROLE_ALIASES[firstWord];
    const restPrompt = text.slice(firstWord.length).trim();
    const info = AXON_NODES[targetNodeId];
    telegramActiveNode = targetNodeId;

    if (!restPrompt && !hasPhoto) {
      await tgSendText(
        chatId,
        `Target Axon dipindahkan ke:\nNode: ${info.label} (${targetNodeId})\nPath: ${info.cwd}`
      );
      return;
    }

    const images = [];
    if (hasPhoto) {
      const bestPhoto = msg.photo[msg.photo.length - 1];
      const imgObj = await tgDownloadFileBase64(bestPhoto.file_id);
      if (imgObj) images.push(imgObj);
    }
    await dispatchTelegramPrompt(chatId, targetNodeId, restPrompt || "Analyze this image.", images);
    return;
  }

  // 8. /node <id>
  if (text.startsWith("/node ")) {
    const reqNode = text.slice(6).trim();
    if (AXON_NODES[reqNode]) {
      telegramActiveNode = reqNode;
      const info = AXON_NODES[reqNode];
      await tgSendText(chatId, `Target aktif diubah ke:\nNode: ${info.label} (${reqNode})\nPath: ${info.cwd}`);
    } else {
      await tgSendText(chatId, `Node tidak dikenal: ${reqNode}`, getNodesKeyboard());
    }
    return;
  }

  // 9. Normal chat or photo -> dispatch to active Axon node
  const images = [];
  if (hasPhoto) {
    const bestPhoto = msg.photo[msg.photo.length - 1];
    const imgObj = await tgDownloadFileBase64(bestPhoto.file_id);
    if (imgObj) images.push(imgObj);
  }

  await dispatchTelegramPrompt(
    chatId,
    telegramActiveNode,
    text || "Analyze the attached image(s).",
    images
  );
}

async function startTelegramBridge() {
  if (!TELEGRAM_BOT_TOKEN) return;
  console.log("[Axon Telegram] Starting Jarvis <-> Axon 2-Way Bridge...");
  let offset = 0;

  // Register Telegram slash command menu so typing / shows all Axon commands
  tgCurlJson(
    "setMyCommands",
    {
      commands: [
        { command: "sessions", description: "Pilih Workspace atau Sesi Pi (.jsonl)" },
        { command: "status", description: "Cek target aktif, path, dan status Axon" },
        { command: "newsession", description: "Buat sesi baru di path folder tertentu" },
        { command: "axon", description: "Pindah/kirim prompt ke Axon Studio" },
        { command: "matcha", description: "Pindah/kirim prompt ke Matcha Showcase" },
        { command: "dev1", description: "Pindah/kirim prompt ke Dev 1 (Belajar)" },
        { command: "dev2", description: "Pindah/kirim prompt ke Dev 2 (Cerita)" },
        { command: "designer", description: "Pindah/kirim prompt ke Designer (Aset)" },
        { command: "qa", description: "Pindah/kirim prompt ke QA & Tester" },
        { command: "abort", description: "Hentikan paksa eksekusi berjalan (Esc)" },
        { command: "compact", description: "Ringkas memori sesi aktif" },
        { command: "help", description: "Bantuan & daftar perintah Jarvis x Axon" },
      ],
    },
    10
  ).catch(() => {});

  // Flush stale updates on startup so old chats aren't replayed
  const initRes = await tgCurlJson("getUpdates", { offset: -1, timeout: 1 }, 10);
  if (initRes && initRes.ok) {
    telegramOnline = true;
    if (Array.isArray(initRes.result) && initRes.result.length > 0) {
      offset = initRes.result[initRes.result.length - 1].update_id + 1;
    }
    console.log(`[Axon Telegram] Jarvis Bot connected! Active node: ${telegramActiveNode}`);
  }

  const poll = async () => {
    try {
      const res = await tgCurlJson("getUpdates", { offset, timeout: 25 }, 35);
      telegramLastPollAt = new Date().toISOString();
      if (res && res.ok) {
        telegramOnline = true;
        for (const update of res.result || []) {
          offset = update.update_id + 1;
          handleTelegramUpdate(update).catch((err) =>
            console.error("[Axon Telegram] Update handler error:", err)
          );
        }
      }
    } catch (err) {
      console.error("[Axon Telegram] Poll error:", err.message);
    }
    setTimeout(poll, 400);
  };

  poll();
}
