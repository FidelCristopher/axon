using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace AxonStudio
{
    static class Program
    {
        private const string HealthUrl = "http://127.0.0.1:1425/api/health";
        private const string PresenceUrl = "http://127.0.0.1:1425/api/presence";
        private const string AppUrl = "http://127.0.0.1:1425/";
        private const string DiscordClientId = "1575137660429795348";
        private const string DiscordLargeImageKey = "axon-logo";

        [STAThread]
        static void Main()
        {
            try
            {
                if (!IsBridgeOnline())
                {
                    StartWslPiBridge();
                    bool ready = WaitForBridge(25000);
                    if (!ready)
                    {
                        MessageBox.Show(
                            "Axon Pi Bridge did not respond within 25 seconds.\nCheck /tmp/axon-pi-bridge.log in WSL.",
                            "Axon Studio",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Warning
                        );
                        return;
                    }
                }

                Process appProc = LaunchAppWindow();

                // Run Discord Rich Presence loop while Axon Studio window is open
                bool createdNew;
                using (var rpcMutex = new Mutex(true, "Local\\AxonStudioDiscordRpc", out createdNew))
                {
                    if (createdNew)
                    {
                        RunDiscordPresenceLoop(appProc);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Failed to launch Axon Studio:\n\n" + ex.Message,
                    "Axon Studio",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        static bool IsBridgeOnline()
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(HealthUrl);
                req.Timeout = 800;
                req.Method = "GET";
                using (var resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        static void StartWslPiBridge()
        {
            var psi = new ProcessStartInfo
            {
                FileName = "wsl.exe",
                Arguments = "-d Ubuntu -u fidel -- bash /mnt/c/Users/Pongo/axon/server/axonSupervisor.sh",
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            Process.Start(psi);
        }

        static bool WaitForBridge(int maxWaitMs)
        {
            int elapsed = 0;
            while (elapsed < maxWaitMs)
            {
                if (IsBridgeOnline()) return true;
                Thread.Sleep(300);
                elapsed += 300;
            }
            return IsBridgeOnline();
        }

        static string FindBrowser()
        {
            string[] candidates = new[]
            {
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
            };
            foreach (var p in candidates)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }

        static Process LaunchAppWindow()
        {
            string browser = FindBrowser();
            string profileDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AxonStudio",
                "ChromeProfile"
            );
            Directory.CreateDirectory(profileDir);

            if (browser != null)
            {
                var psi = new ProcessStartInfo
                {
                    FileName = browser,
                    Arguments = string.Format(
                        "--app={0} --window-size=1440,900 --user-data-dir=\"{1}\" --no-first-run --no-default-browser-check --disable-sync --disable-features=msImplicitSignIn,msEdgeAccountConsistency",
                        AppUrl,
                        profileDir
                    ),
                    UseShellExecute = false
                };
                return Process.Start(psi);
            }
            else
            {
                return Process.Start(new ProcessStartInfo(AppUrl) { UseShellExecute = true });
            }
        }

        // ====================================================================
        // Zero-Dependency Native Windows Discord Rich Presence (IPC Named Pipe)
        // ====================================================================
        static NamedPipeClientStream ConnectDiscordPipe()
        {
            for (int i = 0; i < 10; i++)
            {
                try
                {
                    var pipe = new NamedPipeClientStream(".", "discord-ipc-" + i, PipeDirection.InOut);
                    pipe.Connect(300);
                    if (pipe.IsConnected)
                    {
                        string handshake = "{\"v\":1,\"client_id\":\"" + DiscordClientId + "\"}";
                        WriteDiscordFrame(pipe, 0, handshake);
                        ReadDiscordFrame(pipe);
                        return pipe;
                    }
                    pipe.Dispose();
                }
                catch
                {
                    // try next ipc slot
                }
            }
            return null;
        }

        static void WriteDiscordFrame(Stream pipe, int opcode, string json)
        {
            byte[] payload = Encoding.UTF8.GetBytes(json);
            byte[] header = new byte[8];
            Buffer.BlockCopy(BitConverter.GetBytes(opcode), 0, header, 0, 4);
            Buffer.BlockCopy(BitConverter.GetBytes(payload.Length), 0, header, 4, 4);
            pipe.Write(header, 0, 8);
            pipe.Write(payload, 0, payload.Length);
            pipe.Flush();
        }

        static string ReadDiscordFrame(Stream pipe)
        {
            byte[] header = new byte[8];
            int read = 0;
            while (read < 8)
            {
                int n = pipe.Read(header, read, 8 - read);
                if (n <= 0) return null;
                read += n;
            }
            int len = BitConverter.ToInt32(header, 4);
            if (len <= 0 || len > 1024 * 1024) return null;
            byte[] body = new byte[len];
            int bRead = 0;
            while (bRead < len)
            {
                int n = pipe.Read(body, bRead, len - bRead);
                if (n <= 0) break;
                bRead += n;
            }
            return Encoding.UTF8.GetString(body, 0, bRead);
        }

        static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " ");
        }

        static string ExtractJsonString(string json, string key)
        {
            var m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");
            if (!m.Success) return "";
            return Regex.Unescape(m.Groups[1].Value);
        }

        static bool ExtractJsonBool(string json, string key)
        {
            var m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*(true|false)");
            return m.Success && m.Groups[1].Value == "true";
        }

        static string FetchPresenceJson()
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(PresenceUrl);
                req.Timeout = 1000;
                req.Method = "GET";
                using (var resp = (HttpWebResponse)req.GetResponse())
                using (var sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                {
                    return sr.ReadToEnd();
                }
            }
            catch
            {
                return null;
            }
        }

        static long NowUnixSeconds()
        {
            return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
        }

        static bool IsAxonWindowOpen()
        {
            try
            {
                foreach (var name in new[] { "chrome", "msedge" })
                {
                    foreach (var p in Process.GetProcessesByName(name))
                    {
                        try
                        {
                            if (!string.IsNullOrEmpty(p.MainWindowTitle) &&
                                p.MainWindowTitle.IndexOf("Axon Studio", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                return true;
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
            return false;
        }

        static void LogRpc(string msg)
        {
            try
            {
                string logDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "AxonStudio"
                );
                Directory.CreateDirectory(logDir);
                File.AppendAllText(
                    Path.Combine(logDir, "discord-rpc.log"),
                    DateTime.Now.ToString("HH:mm:ss") + " " + msg + Environment.NewLine
                );
            }
            catch { }
        }

        static void RunDiscordPresenceLoop(Process appProc)
        {
            NamedPipeClientStream pipe = null;
            string lastKey = null;
            long startTs = NowUnixSeconds();
            int pid = Process.GetCurrentProcess().Id;
            DateTime launchedAt = DateTime.UtcNow;
            int closedTicks = 0;

            LogRpc("Discord RPC loop started (ClientId=" + DiscordClientId + ")");

            try
            {
                while (true)
                {
                    // Wait 12s grace period for Chrome --app window to appear, then exit only after window is actually closed
                    if ((DateTime.UtcNow - launchedAt).TotalSeconds > 12)
                    {
                        if (!IsAxonWindowOpen())
                        {
                            closedTicks++;
                            if (closedTicks >= 3)
                            {
                                LogRpc("Axon Studio window closed. Clearing Discord RPC.");
                                break;
                            }
                        }
                        else
                        {
                            closedTicks = 0;
                        }
                    }

                    if (pipe == null || !pipe.IsConnected)
                    {
                        if (pipe != null)
                        {
                            try { pipe.Dispose(); } catch { }
                            pipe = null;
                        }
                        pipe = ConnectDiscordPipe();
                        if (pipe != null && pipe.IsConnected)
                        {
                            LogRpc("Connected to Discord IPC pipe!");
                        }
                        lastKey = null;
                    }

                    if (pipe != null && pipe.IsConnected)
                    {
                        string raw = FetchPresenceJson();
                        bool isActive = raw != null && ExtractJsonBool(raw, "active");
                        string sessionName = raw != null ? ExtractJsonString(raw, "sessionName") : "";
                        string category = raw != null ? ExtractJsonString(raw, "category") : "Standby";

                        string details = isActive && !string.IsNullOrEmpty(sessionName)
                            ? "Session: " + sessionName
                            : "Idling";
                        string state = isActive && !string.IsNullOrEmpty(category)
                            ? "Workspace: " + category
                            : "Standby • Zero-Idle";

                        string currentKey = details + "|" + state;
                        if (currentKey != lastKey)
                        {
                            if (lastKey != null) startTs = NowUnixSeconds();
                            string nonce = Guid.NewGuid().ToString();
                            string payload = string.Format(
                                "{{\"cmd\":\"SET_ACTIVITY\",\"args\":{{\"pid\":{0},\"activity\":{{\"details\":\"{1}\",\"state\":\"{2}\",\"timestamps\":{{\"start\":{3}}},\"assets\":{{\"large_image\":\"{4}\",\"large_text\":\"Axon Studio\"}}}}}},\"nonce\":\"{5}\"}}",
                                pid,
                                EscapeJson(details),
                                EscapeJson(state),
                                startTs,
                                DiscordLargeImageKey,
                                nonce
                            );
                            try
                            {
                                WriteDiscordFrame(pipe, 1, payload);
                                string reply = ReadDiscordFrame(pipe);
                                LogRpc("SET_ACTIVITY (" + details + ") -> " + (reply != null ? reply.Substring(0, Math.Min(180, reply.Length)) : "null"));
                                lastKey = currentKey;
                            }
                            catch (Exception ex)
                            {
                                LogRpc("IPC error: " + ex.Message);
                                try { pipe.Dispose(); } catch { }
                                pipe = null;
                                lastKey = null;
                            }
                        }
                    }

                    Thread.Sleep(2000);
                }
            }
            finally
            {
                if (pipe != null)
                {
                    try { pipe.Dispose(); } catch { }
                }
            }
        }
    }
}
