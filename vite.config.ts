import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'

function sessionHistoryPlugin() {
  return {
    name: 'session-history-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/session-history')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost:1420');
        const sessionId = url.searchParams.get('id') || '';
        const sessionFile = url.searchParams.get('file') || '';

        // Search directory: ~/.pi/agent/sessions/--home-fidel--/
        const sessionsDir = path.join(os.homedir(), '.pi', 'agent', 'sessions', '--home-fidel--');

        let targetPath = '';
        if (sessionFile && fs.existsSync(path.join(sessionsDir, sessionFile))) {
          targetPath = path.join(sessionsDir, sessionFile);
        } else if (sessionId) {
          const directFile = path.join(sessionsDir, `${sessionId}.jsonl`);
          if (fs.existsSync(directFile)) {
            targetPath = directFile;
          } else {
            try {
              const files = fs.readdirSync(sessionsDir);
              const match = files.find(f => f.includes(sessionId) && f.endsWith('.jsonl'));
              if (match) targetPath = path.join(sessionsDir, match);
            } catch {}
          }
        }

        if (!targetPath || !fs.existsSync(targetPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Session file not found', targetPath }));
        }

        try {
          const messages: any[] = [];
          const fileStream = fs.createReadStream(targetPath);
          const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

          for await (const line of rl) {
            if (!line.trim()) continue;
            try {
              const item = JSON.parse(line);
              if (item.type === 'message' && item.message) {
                const m = item.message;
                if (m.role === 'system') continue;

                let text = '';
                const tools: any[] = [];

                if (Array.isArray(m.content)) {
                  for (const c of m.content) {
                    if (c.type === 'text' && c.text) text += (text ? '\n' : '') + c.text;
                    if (c.type === 'toolCall') tools.push({ type: 'call', name: c.name, args: c.arguments });
                    if (c.type === 'toolResult') tools.push({ type: 'result', output: String(c.output || '').slice(0, 300) });
                  }
                } else if (typeof m.content === 'string') {
                  text = m.content;
                }

                if (text || tools.length > 0) {
                  messages.push({
                    id: item.id || `msg-${messages.length}`,
                    role: m.role,
                    text,
                    tools: tools.length > 0 ? tools : undefined,
                    timestamp: m.timestamp || item.timestamp,
                    model: m.model || undefined,
                  });
                }
              }
            } catch {}
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            sessionId,
            filePath: targetPath,
            totalMessages: messages.length,
            messages,
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), sessionHistoryPlugin()],
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
})
