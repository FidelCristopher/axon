const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const {
  createAgentSession,
  SessionManager,
} = require("/home/fidel/.pi/agent/install/releases/1.6.0/node_modules/@earendil-works/pi-coding-agent");

const PORT = 1425;
const SESSIONS_DIR = "/home/fidel/.pi/agent/sessions/--home-fidel--";
const activeSessions = new Map();
const sseClients = new Set();

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

  const opts = { cwd: safeCwd };
  if (existingFile) {
    try {
      opts.sessionManager = SessionManager.open(existingFile);
    } catch (e) {
      console.warn(`[Pi Bridge] Could not open session ${existingFile}, starting fresh:`, e.message);
    }
  }

  const { session } = await createAgentSession(opts);

  session.subscribe((event) => {
    if (event.type === "message_update") {
      const assistantEvent = event.assistantMessageEvent;
      if (assistantEvent && assistantEvent.type === "text_delta") {
        broadcastEvent("text_delta", {
          nodeId,
          delta: assistantEvent.delta,
        });
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
      broadcastEvent("agent_start", { nodeId });
    } else if (event.type === "agent_end") {
      const usage = session.messages[session.messages.length - 1]?.usage || {};
      broadcastEvent("agent_end", {
        nodeId,
        usage,
      });
    }
  });

  activeSessions.set(nodeId, session);
  return session;
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
      const session = await getOrCreateSession(targetNode, cwd, sessionId);

      if (thinkingLevel && typeof session.setThinkingLevel === "function") {
        try {
          session.setThinkingLevel(thinkingLevel);
        } catch {
          // ignore if unsupported by model
        }
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
      res.end(JSON.stringify({ accepted: true, nodeId: targetNode }));

      broadcastEvent("agent_start", { nodeId: targetNode });
      const promptOpts = formattedImages.length > 0 ? { images: formattedImages } : undefined;
      session
        .prompt((prompt || "Analyze the attached image(s).").trim(), promptOpts)
        .catch((err) => {
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
        const session = activeSessions.get(nodeId);
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
});
