using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;

internal static class CodexDreamSkinLauncher
{
    private const int SwRestore = 9;

    [DllImport("user32.dll")]
    private static extern bool ShowWindowAsync(IntPtr window, int command);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            string baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
            string script = Path.GetFullPath(Path.Combine(baseDirectory, "..", "scripts", "start-dream-skin.ps1"));
            if (!File.Exists(script))
            {
                throw new FileNotFoundException("Codex Dream Skin startup script was not found.", script);
            }

            string forwarded = string.Join(" ", args.Select(QuoteArgument).ToArray());
            string arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File " +
                QuoteArgument(script) + " -WaitForNetwork -RestartExisting";
            if (forwarded.Length > 0)
            {
                arguments += " " + forwarded;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                    "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
                Arguments = arguments,
                WorkingDirectory = Path.GetFullPath(Path.Combine(baseDirectory, "..")),
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            Process launcher = Process.Start(startInfo);
            if (launcher == null)
            {
                throw new InvalidOperationException("Codex Dream Skin startup process could not be created.");
            }
            launcher.WaitForExit();
            if (launcher.ExitCode != 0)
            {
                return launcher.ExitCode;
            }

            ActivateCodexWindow();
            return 0;
        }
        catch (Exception error)
        {
            string stateRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CodexDreamSkin");
            Directory.CreateDirectory(stateRoot);
            File.AppendAllText(Path.Combine(stateRoot, "native-launcher-error.log"),
                DateTimeOffset.Now.ToString("o") + " " + error + Environment.NewLine);
            return 1;
        }
    }

    private static void ActivateCodexWindow()
    {
        for (int attempt = 0; attempt < 40; attempt++)
        {
            Process candidate = Process.GetProcessesByName("ChatGPT")
                .Where(process => process.MainWindowHandle != IntPtr.Zero)
                .OrderByDescending(process =>
                {
                    try { return process.StartTime; }
                    catch { return DateTime.MinValue; }
                })
                .FirstOrDefault();
            if (candidate != null)
            {
                IntPtr window = candidate.MainWindowHandle;
                ShowWindowAsync(window, SwRestore);
                SetForegroundWindow(window);
                return;
            }
            Thread.Sleep(250);
        }
    }

    private static string QuoteArgument(string value)
    {
        if (string.IsNullOrEmpty(value)) return "\"\"";
        if (value.IndexOfAny(new[] { ' ', '\t', '\"' }) < 0) return value;
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}
