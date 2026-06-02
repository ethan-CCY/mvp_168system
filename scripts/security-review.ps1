param(
  [ValidateSet("staged", "all")]
  [string]$Mode = "all"
)

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
  Write-Error "Not inside a Git repository."
  exit 1
}

Set-Location $repoRoot

$blockedNames = @(
  "(^|/)\.env$",
  "(^|/)\.env\.(local|development|production|test)$",
  "\.pem$",
  "\.key$",
  "id_rsa$",
  "id_ed25519$",
  "credentials\.json$",
  "service-account.*\.json$"
)

$secretPatterns = @(
  "-----BEGIN (RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----",
  "(?i)\b(password|passwd|pwd)\b\s*[:=]\s*['""][^'""]{4,}['""]",
  "(?i)\b(api[_-]?key|secret|token|access[_-]?token|refresh[_-]?token|client[_-]?secret)\b\s*[:=]\s*['""][^'""]{8,}['""]",
  "ghp_[A-Za-z0-9_]{20,}",
  "github_pat_[A-Za-z0-9_]{20,}",
  "sk-[A-Za-z0-9]{20,}",
  "AIza[0-9A-Za-z\-_]{35}",
  "AKIA[0-9A-Z]{16}",
  "(?i)bearer\s+[A-Za-z0-9\-._~+/]{20,}=*"
)

$skipDirs = @(
  "node_modules/",
  "dist/",
  ".git/",
  ".vite/"
)

function Normalize-PathForGit([string]$Path) {
  return ($Path -replace "\\", "/")
}

function Should-Skip([string]$Path) {
  $normalized = Normalize-PathForGit $Path
  foreach ($dir in $skipDirs) {
    if ($normalized.StartsWith($dir)) {
      return $true
    }
  }
  return $false
}

if ($Mode -eq "staged") {
  $files = git diff --cached --name-only --diff-filter=ACMR
} else {
  $files = git ls-files
}

$files = $files | Where-Object { $_ -and -not (Should-Skip $_) }
$findings = New-Object System.Collections.Generic.List[string]

foreach ($file in $files) {
  $normalized = Normalize-PathForGit $file

  foreach ($namePattern in $blockedNames) {
    if ($normalized -match $namePattern) {
      $findings.Add("Blocked sensitive file name: $normalized")
      break
    }
  }

  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    continue
  }

  $item = Get-Item -LiteralPath $file
  if ($item.Length -gt 1048576) {
    continue
  }

  try {
    $content = Get-Content -LiteralPath $file -Raw -ErrorAction Stop
  } catch {
    continue
  }

  foreach ($pattern in $secretPatterns) {
    if ($content -match $pattern) {
      $findings.Add("Possible secret in: $normalized")
      break
    }
  }
}

if ($findings.Count -gt 0) {
  Write-Host ""
  Write-Host "Security review failed. Check these items before commit/push:" -ForegroundColor Red
  $findings | Sort-Object -Unique | ForEach-Object {
    Write-Host " - $_" -ForegroundColor Yellow
  }
  Write-Host ""
  Write-Host "If this is a false positive, move the value to .env, document only placeholders, or adjust scripts/security-review.ps1 deliberately." -ForegroundColor Cyan
  exit 1
}

Write-Host "Security review passed ($Mode)." -ForegroundColor Green
