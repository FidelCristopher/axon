const http = require("http");
const fs = require("fs");
const path = require("path");
const { createAgentSession } = require("/home/fidel/.pi/agent/install/releases/1.6.0/node_modules/@earendil-works/pi-coding-agent");

const PORT = 1425;
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

async function getOrCreateSession(nodeId, cwd) {
  if (activeSessions.has(nodeId)) {
    return activeSessions.get(nodeId);
  }

  const safeCwd = (cwd && fs.existsSync(cwd)) ? cwd : process.cwd();
  console.log(`[Pi Bridge] Spawning native Pi session for [${nodeId}] in: ${safeCwd}`);

  const { session } = await createAgentSession({ cwd: safeCwd });

  // Subscribe to real Pi session lifecycle events
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

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // SSE Stream for Real-time Token & Tool Telemetry
  if (url.pathname === "/api/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write("data: {\"type\":\"connected\"}\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  // Health check
  if (url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "online", activeSessions: activeSessions.size }));
    return;
  }

  // Dispatch prompt to local Pi session
  if (url.pathname === "/api/prompt" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { nodeId, cwd, prompt } = JSON.parse(body);
        if (!prompt || !prompt.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Prompt is required" }));
          return;
        }

        const session = await getOrCreateSession(nodeId || "hub-main", cwd);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: true, nodeId }));

        // Execute prompt asynchronously through real Pi engine
        broadcastEvent("agent_start", { nodeId });
        session.prompt(prompt.trim()).catch((err) => {
          broadcastEvent("agent_error", { nodeId, error: err.message });
        });
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Compact session memory
  if (url.pathname === "/api/compact" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { nodeId } = JSON.parse(body);
        if (nodeId && activeSessions.has(nodeId)) {
          const session = activeSessions.get(nodeId);
          await session.prompt("/compact");
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, nodeId }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Pi Native Bridge] Online and listening on http://0.0.0.0:${PORT}`);
});
