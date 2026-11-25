const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile, spawn } = require("child_process");
const {
  createAgentSessionServices,
  createAgentSessionFromServices,
  SessionManager,
} = require("/home/fidel/.pi/agent/install/releases/1.6.0/node_modules/@earendil-works/pi-coding-agent");

const PORT = 1425;
const SESSIONS_DIR = "/home/fidel/.pi/agent/sessions/--home-fidel--";
const activeSessions = new Map();
const servicesCache = new Map();
const sseClients = new Set();

// ============================================================================
// JARVIS TELEGRAM BOT <-> AXON STUDIO 2-WAY BRIDGE
// ============================================================================
const TELEGRAM_BOT_TOKEN =
  process.env.JARVIS_BOT_TOKEN || "9066504208:AAFHUFWIAW00z2Zk6snbGv2xP7lCEs7yH1k";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_OWNER_FILE = path.join(os.homedir(), ".pi", "agent", "telegram_owner.json");

const AXON_NODES = {
  "hub-main": {
    label: "Hub Utama (Lead Architect)",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning",
    sessionId: "9d8a42bd-be72-4036-82ac-daccb1d64d3c",
  },
  "node-dev-1": {
    label: "Dev 1 (Belajar)",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning",
    sessionId: "4f28aa1b-9e41-4172-8801-7fa8bc31889a",
  },
  "node-dev-2": {
    label: "Dev 2 (Cerita)",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning",
    sessionId: "8c91024e-128a-4f51-b019-33aa91b17cc1",
  },
  "node-designer": {
    label: "Designer (Aset)",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning",
    sessionId: "e5518b9c-7201-49b8-9311-190ab751b32f",
  },
  "node-qa": {
    label: "QA & Tester",
    cwd: "/mnt/c/Users/Pongo/AndroidStudioProjects/ChineseLearning",
    sessionId: "b71239aa-5529-410a-8120-cf918a22114d",
  },
};

let telegramActiveNode = "hub-main";
const telegramPendingReplies = new Map(); // nodeId -> { chatId, buffer }
let telegramOnline = false;
let telegramLastPollAt = null;

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

function getNodesKeyboard() {
  return {
    inline_keyboard: Object.entries(AXON_NODES).map(([id, info]) => [
      {
        text: `${id === telegramActiveNode ? "[AKTIF] " : ""}${info.label} (${id})`,
        callback_data: `axon_node:${id}`,
      },
    ]),
  };
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

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === "message" && obj.message) {
        const role = obj.message.role;
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
              tools.push({
                type: "toolCall",
                name: block.name || "tool",
                args: block.arguments || block.args || {},
              });
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

  session.subscribe((event) => {
    if (event.type === "message_update") {
      const assistantEvent = event.assistantMessageEvent;
      if (assistantEvent && assistantEvent.type === "text_delta") {
        broadcastEvent("text_delta", {
          nodeId,
          delta: assistantEvent.delta,
        });
        const pending = telegramPendingReplies.get(nodeId);
        if (pending) {
          pending.buffer += assistantEvent.delta || "";
        }
      } else if (assistantEvent && assistantEvent.type === "thinking_delta") {
        broadcastEvent("thinking_delta", {
          nodeId,
          delta: assistantEvent.delta,
        });
      }
    } else if (event.type === "message_end") {
      if (event.message && event.message.stopReason === "error") {
        const errMsg = event.message.errorMessage || "Model returned an error";
        console.error(`[Pi Bridge] [${nodeId}] Model error:`, errMsg);
        broadcastEvent("agent_error", {
          nodeId,
          error: errMsg,
        });
        const pending = telegramPendingReplies.get(nodeId);
        if (pending) {
          telegramPendingReplies.delete(nodeId);
          tgSendText(pending.chatId, `[Axon • ${nodeId}] Error:\n${errMsg}`).catch(() => {});
        }
      }
    } else if (event.type === "tool_execution_start") {
      broadcastEvent("tool_start", {
        nodeId,
        tool: event.toolName,
        args: event.args,
      });
    } else if (event.type === "tool_execution_end") {
      broadcastEvent("tool_end", {
        nodeId,
        tool: event.toolName,
        isError: event.isError,
      });
    } else if (event.type === "agent_start") {
      broadcastEvent("agent_start", {
        nodeId,
        model: session.model ? `${session.model.provider}/${session.model.id}` : undefined,
      });
    } else if (event.type === "agent_end") {
      const usage = session.messages[session.messages.length - 1]?.usage || {};
      broadcastEvent("agent_end", {
        nodeId,
        usage,
      });
      const pending = telegramPendingReplies.get(nodeId);
      if (pending) {
        telegramPendingReplies.delete(nodeId);
        const replyText = pending.buffer.trim() || "(Selesai tanpa teks output)";
        tgSendText(pending.chatId, `[Axon • ${nodeId}]\n\n${replyText}`).catch(() => {});
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

  // 3. Real Pi Session History (.jsonl) Reader
  if (url.pathname === "/api/session-history" && req.method === "GET") {
    try {
      const lookupId = url.searchParams.get("id") || "";
      const filePath = findSessionFile(lookupId);
      if (!filePath) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ found: false, messages: [] }));
        return;
      }
      const messages = parseSessionHistory(filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          found: true,
          file: path.basename(filePath),
          totalMessages: messages.length,
          messages,
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

  // 5. Compact Session Memory
  if (url.pathname === "/api/compact" && req.method === "POST") {
    try {
      const { nodeId } = await readJsonBody(req);
      if (nodeId && activeSessions.has(nodeId)) {
        const { session } = activeSessions.get(nodeId);
        if (typeof session.compact === "function") {
          await session.compact();
        } else {
          await session.prompt("/compact");
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, nodeId }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
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
      broadcastEvent("agent_aborted", { nodeId });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ aborted: true, nodeId }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 6. Real Git Worktree Creation
  if (url.pathname === "/api/worktree" && req.method === "POST") {
    try {
      const { repoPath, branchName, worktreeDir } = await readJsonBody(req);
      if (!repoPath || !branchName || !worktreeDir) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "repoPath, branchName, and worktreeDir are required" }));
        return;
      }
      execFile(
        "git",
        ["-C", repoPath, "worktree", "add", "-b", branchName, worktreeDir],
        (err, stdout, stderr) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: stderr || err.message }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, stdout }));
        }
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Axon Pi Native Bridge] Online at http://127.0.0.1:${PORT}`);
  startTelegramBridge();
});

async function handleTelegramUpdate(update) {
  const ownerChatId = getTelegramOwnerChatId();

  // Handle inline button node switch
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    if (ownerChatId && Number(chatId) !== ownerChatId) return;

    await tgCurlJson("answerCallbackQuery", { callback_query_id: cb.id }, 10);
    if (cb.data && cb.data.startsWith("axon_node:")) {
      const nextNode = cb.data.replace("axon_node:", "");
      if (AXON_NODES[nextNode]) {
        telegramActiveNode = nextNode;
        await tgSendText(
          chatId,
          `Target Axon dipindahkan ke:\n${AXON_NODES[nextNode].label} (${nextNode})\n\nLangsung kirim pesan untuk chat ke node ini.`
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
  if (!text) return;

  // Commands
  if (text === "/start" || text === "/help") {
    const info = AXON_NODES[telegramActiveNode] || { label: telegramActiveNode };
    await tgSendText(
      chatId,
      `Jarvis x Axon Studio Bridge AKTIF.\n\n` +
        `Node aktif: ${info.label} (${telegramActiveNode})\n\n` +
        `Perintah:\n` +
        `/nodes - Pilih node Axon tujuan\n` +
        `/status - Cek status Axon Bridge\n\n` +
        `Atau langsung ketik pesan apa saja untuk dikirim ke Axon Studio!`,
      getNodesKeyboard()
    );
    return;
  }

  if (text === "/nodes") {
    await tgSendText(chatId, "Pilih node Axon tujuan:", getNodesKeyboard());
    return;
  }

  if (text.startsWith("/node ")) {
    const reqNode = text.slice(6).trim();
    if (AXON_NODES[reqNode]) {
      telegramActiveNode = reqNode;
      await tgSendText(chatId, `Node aktif diubah ke: ${AXON_NODES[reqNode].label} (${reqNode})`);
    } else {
      await tgSendText(chatId, `Node tidak dikenal: ${reqNode}`, getNodesKeyboard());
    }
    return;
  }

  if (text === "/status") {
    const info = AXON_NODES[telegramActiveNode] || { label: telegramActiveNode };
    await tgSendText(
      chatId,
      `Axon Bridge: ONLINE (port ${PORT})\n` +
        `Node aktif: ${info.label} (${telegramActiveNode})\n` +
        `Sesi Pi aktif: ${activeSessions.size}`
    );
    return;
  }

  // Forward normal chat message directly to Axon Pi session
  const nodeId = telegramActiveNode;
  const nodeCfg = AXON_NODES[nodeId] || AXON_NODES["hub-main"];

  await tgCurlJson("sendChatAction", { chat_id: chatId, action: "typing" }, 10);
  broadcastEvent("user_message", {
    nodeId,
    text: `[Telegram] ${text}`,
    source: "telegram",
    timestamp: Date.now(),
  });

  try {
    const { session } = await getOrCreateSession(nodeId, nodeCfg.cwd, nodeCfg.sessionId);
    telegramPendingReplies.set(nodeId, { chatId, buffer: "" });
    session.prompt(text).catch((err) => {
      console.error(`[Axon Telegram] Prompt error on [${nodeId}]:`, err);
      telegramPendingReplies.delete(nodeId);
      broadcastEvent("agent_error", { nodeId, error: err.message });
      tgSendText(chatId, `[Axon • ${nodeId}] Gagal memproses:\n${err.message}`).catch(() => {});
    });
  } catch (err) {
    telegramPendingReplies.delete(nodeId);
    await tgSendText(chatId, `[Axon • ${nodeId}] Error koneksi sesi:\n${err.message}`);
  }
}

async function startTelegramBridge() {
  if (!TELEGRAM_BOT_TOKEN) return;
  console.log("[Axon Telegram] Starting Jarvis <-> Axon 2-Way Bridge...");
  let offset = 0;

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
