using System;
using System.Diagnostics;
using System.IO;
using System.Linq;

internal static class CodexDreamSkinLauncher
{
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
            Process.Start(startInfo);
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

    private static string QuoteArgument(string value)
    {
        if (string.IsNullOrEmpty(value)) return "\"\"";
        if (value.IndexOfAny(new[] { ' ', '\t', '\"' }) < 0) return value;
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}
