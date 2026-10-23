$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$patterns = @(
    'ghp_[A-Za-z0-9]{20,}',
    'github_pat_[A-Za-z0-9_]{20,}',
    'sk-[A-Za-z0-9]{20,}',
    '(?i)[?&]enc=(?!REDACTED|YOUR_)[A-Za-z0-9]+',
    '(?i)[?&]cpi=(?!REDACTED|YOUR_)\d+',
    '(?i)[?&]openc=(?!REDACTED|YOUR_)[A-Za-z0-9]+',
    '(?i)[?&]p_auth_token=(?!REDACTED|YOUR_)[A-Za-z0-9_-]{8,}'
)

$files = Get-ChildItem -LiteralPath $root -Recurse -File |
    Where-Object {
        $_.FullName -notmatch '\\\.git\\|\\diagnostics\\snapshots\\' -and
        $_.Extension -in '.js', '.json', '.md', '.txt', '.html', '.yml', '.yaml'
    }

$matches = foreach ($pattern in $patterns) {
    $files | Select-String -Pattern $pattern
}

if ($matches) {
    $matches | Select-Object Path, LineNumber, Line | Format-List
    throw "发现疑似敏感参数，请脱敏后再提交。"
}

Write-Host "安全检查通过：未发现已知的 Token 或个人课程参数。"

