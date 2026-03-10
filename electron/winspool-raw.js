const { spawn } = require('node:child_process');

function assertWindows() {
  if (process.platform !== 'win32') {
    throw new Error('Windows raw printer mode is only supported on Windows');
  }
}

function psQuote(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function buildCommonScriptBody(printerName) {
  return `
$printerName = '${psQuote(printerName)}'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFO di);

  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}
"@

function ThrowLastWin32([string] $prefix) {
  $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  throw "$prefix (Win32: $code)"
}

$handle = [IntPtr]::Zero
if (-not [RawPrinterHelper]::OpenPrinter($printerName, [ref] $handle, [IntPtr]::Zero)) {
  ThrowLastWin32 "Failed to open printer '$printerName'"
}
`;
}

function runPowerShell(script) {
  assertWindows();

  return new Promise((resolve, reject) => {
    // Use stdin piping instead of -EncodedCommand to avoid OS command-line
    // length limits (ENAMETOOLONG) when scripts contain large base64 data.
    const child = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        '-',
      ],
      {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code !== 0) {
        const detail = (stderr || stdout).trim();
        reject(new Error(detail || 'PowerShell printer command failed'));
        return;
      }
      resolve(stdout.trim());
    });

    // Pipe the entire script through stdin — no size limit
    child.stdin.write(script, 'utf-8');
    child.stdin.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testWindowsPrinter(printerName) {
  if (!printerName) {
    throw new Error('Select a Windows printer first');
  }

  const script = `
${buildCommonScriptBody(printerName)}
try {
  Write-Output "OK"
} finally {
  if ($handle -ne [IntPtr]::Zero) {
    [void] [RawPrinterHelper]::ClosePrinter($handle)
  }
}
`;

  await runPowerShell(script);
  return true;
}

async function getWindowsPrintJobCount(printerName) {
  if (!printerName) {
    throw new Error('Select a Windows printer first');
  }

  const script = `
$printerName = '${psQuote(printerName)}'
$jobs = @(Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -and (($_.Name -split ',', 2)[0]) -eq $printerName
})
Write-Output $jobs.Count
`;

  const output = await runPowerShell(script);
  const count = Number.parseInt(String(output || '0').trim(), 10);
  return Number.isFinite(count) ? count : 0;
}

async function getWindowsPrinterTcpEndpoint(printerName) {
  if (!printerName) {
    throw new Error('Select a Windows printer first');
  }

  const script = `
$printerName = '${psQuote(printerName)}'
$printer = Get-CimInstance Win32_Printer -Filter "Name = '$printerName'" -ErrorAction SilentlyContinue
if (-not $printer -or -not $printer.PortName) {
  return
}

$portNameEscaped = $printer.PortName.Replace("'", "''")
$port = Get-CimInstance Win32_TCPIPPrinterPort -Filter "Name = '$portNameEscaped'" -ErrorAction SilentlyContinue
if (-not $port -or -not $port.HostAddress) {
  return
}

[PSCustomObject]@{
  host = [string] $port.HostAddress
  port = if ($port.PortNumber) { [int] $port.PortNumber } else { 9100 }
} | ConvertTo-Json -Compress
`;

  const output = String(await runPowerShell(script) || '').trim();
  if (!output) {
    return null;
  }

  const parsed = JSON.parse(output);
  if (!parsed?.host) {
    return null;
  }

  const parsedPort = Number(parsed.port);

  return {
    host: String(parsed.host),
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 9100,
  };
}

async function waitForWindowsPrintQueueToDrain(
  printerName,
  baselineCount = 0,
  {
    appearanceTimeoutMs = 1500,
    drainTimeoutMs = 15000,
    pollIntervalMs = 400,
  } = {}
) {
  if (!printerName) {
    throw new Error('Select a Windows printer first');
  }

  const appearanceDeadline = Date.now() + appearanceTimeoutMs;
  let sawQueuedJob = false;

  while (Date.now() < appearanceDeadline) {
    const count = await getWindowsPrintJobCount(printerName);
    if (count > baselineCount) {
      sawQueuedJob = true;
      break;
    }
    await sleep(pollIntervalMs);
  }

  if (!sawQueuedJob) {
    return;
  }

  const drainDeadline = Date.now() + drainTimeoutMs;
  while (Date.now() < drainDeadline) {
    const count = await getWindowsPrintJobCount(printerName);
    if (count <= baselineCount) {
      return;
    }
    await sleep(pollIntervalMs);
  }
}

async function printRawToWindowsPrinter(printerName, buffer, jobName = 'BizArch Receipt') {
  if (!printerName) {
    throw new Error('Select a Windows printer first');
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Nothing to print');
  }

  const dataBase64 = buffer.toString('base64');
  const script = `
${buildCommonScriptBody(printerName)}
$jobName = '${psQuote(jobName)}'
$bytes = [Convert]::FromBase64String('${dataBase64}')
$docInfo = New-Object RawPrinterHelper+DOCINFO
$docInfo.pDocName = $jobName
$docInfo.pDataType = 'RAW'
$docId = 0
$pageStarted = $false
$mem = [IntPtr]::Zero

try {
  $docId = [RawPrinterHelper]::StartDocPrinter($handle, 1, $docInfo)
  if ($docId -le 0) {
    ThrowLastWin32 "Failed to start print document '$jobName'"
  }

  if (-not [RawPrinterHelper]::StartPagePrinter($handle)) {
    ThrowLastWin32 "Failed to start print page"
  }
  $pageStarted = $true

  $mem = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $mem, $bytes.Length)
  $written = 0
  if (-not [RawPrinterHelper]::WritePrinter($handle, $mem, $bytes.Length, [ref] $written)) {
    ThrowLastWin32 "Failed to write raw bytes to printer '$printerName'"
  }
  if ($written -ne $bytes.Length) {
    throw "Incomplete write to printer '$printerName' ($written/$($bytes.Length) bytes)"
  }

  Write-Output "OK"
} finally {
  if ($mem -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::FreeHGlobal($mem)
  }
  if ($pageStarted) {
    [void] [RawPrinterHelper]::EndPagePrinter($handle)
  }
  if ($docId -gt 0) {
    [void] [RawPrinterHelper]::EndDocPrinter($handle)
  }
  if ($handle -ne [IntPtr]::Zero) {
    [void] [RawPrinterHelper]::ClosePrinter($handle)
  }
}
`;

  await runPowerShell(script);
}

module.exports = {
  getWindowsPrintJobCount,
  getWindowsPrinterTcpEndpoint,
  printRawToWindowsPrinter,
  testWindowsPrinter,
  waitForWindowsPrintQueueToDrain,
};
