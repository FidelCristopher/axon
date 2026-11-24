using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace AxonStudio
{
    static class Program
    {
        private const string HealthUrl = "http://127.0.0.1:1425/api/health";
        private const string AppUrl = "http://127.0.0.1:1425/";

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

                LaunchAppWindow();
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
            // Keep wsl.exe attached in foreground (hidden window) so WSL2 NEVER auto-shuts down
            // even when WezTerm is completely closed.
            var psi = new ProcessStartInfo
            {
                FileName = "wsl.exe",
                Arguments = "-d Ubuntu -u fidel -- /home/fidel/.local/share/pi-node/current/bin/node /mnt/c/Users/Pongo/axon/server/axonPiBridge.cjs",
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
            // Prefer Chrome first to avoid Microsoft Edge's Windows-account auto-sync popup
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

        static void LaunchAppWindow()
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
                Process.Start(psi);
            }
            else
            {
                Process.Start(new ProcessStartInfo(AppUrl) { UseShellExecute = true });
            }
        }
    }
}
